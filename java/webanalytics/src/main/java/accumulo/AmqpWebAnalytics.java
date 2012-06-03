package accumulo;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map.Entry;

import org.apache.accumulo.core.Constants;
import org.apache.accumulo.core.client.AccumuloException;
import org.apache.accumulo.core.client.AccumuloSecurityException;
import org.apache.accumulo.core.client.BatchScanner;
import org.apache.accumulo.core.client.BatchWriter;
import org.apache.accumulo.core.client.Connector;
import org.apache.accumulo.core.client.IteratorSetting;
import org.apache.accumulo.core.client.MutationsRejectedException;
import org.apache.accumulo.core.client.TableExistsException;
import org.apache.accumulo.core.client.TableNotFoundException;
import org.apache.accumulo.core.client.ZooKeeperInstance;
import org.apache.accumulo.core.client.admin.TableOperations;
import org.apache.accumulo.core.data.Key;
import org.apache.accumulo.core.data.Mutation;
import org.apache.accumulo.core.data.Range;
import org.apache.accumulo.core.data.Value;
import org.apache.accumulo.core.iterators.LongCombiner.VarLenEncoder;
import org.apache.hadoop.io.Text;

import com.google.gson.Gson;
import com.rabbitmq.client.AMQP.BasicProperties;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;
import com.rabbitmq.client.QueueingConsumer;
import com.rabbitmq.client.ShutdownSignalException;


public class AmqpWebAnalytics implements Runnable {
  // RabbitMQ configuration
  protected String hostName = "localhost";
  protected int portNumber = 5672;
  protected String exchangeName = "accumuloanalytics";
  protected String sendRoutingKey = "webanalytics-post";
  protected String getRoutingKey = "webanalytics-get";
  protected String getResponseRoutingKey = "webanalytics-response-get";
  
  // Accumulo configuration
  protected String tableName = "analytics";
  protected String instanceName = "accumulo1.4";
  protected String zookeepers = "localhost:2181";
  protected String username = "root";
  protected String password = "secret"; // lol
  
  protected boolean done = false;
  protected Channel channel = null;
  protected Connector connector = null;
  protected QueueingConsumer consumer;
  protected BatchWriter writer = null;

  // Some convenience instances
  private final Gson gson = new Gson();
  private final Text cfHolder = new Text(), cqHolder = new Text();
  private final VarLenEncoder encoder = new VarLenEncoder();
  private final Value SINGLE_VALUE = new Value(encoder.encode(1l));
  
  public AmqpWebAnalytics() throws AccumuloException, AccumuloSecurityException, IOException, TableExistsException, TableNotFoundException {
    setupAccumulo();
    
    setupAmqp();
  }
  
  /**
   * Instantiate the Accumulo connector with the configured credentials and ensure that
   * the target table exists.
   * 
   * @throws AccumuloException
   * @throws AccumuloSecurityException
   * @throws TableExistsException
   * @throws TableNotFoundException
   */
  protected void setupAccumulo() throws AccumuloException, AccumuloSecurityException, TableExistsException, TableNotFoundException {
    // Setup the Accumulo Connector
    ZooKeeperInstance instance = new ZooKeeperInstance(this.instanceName, this.zookeepers);
    this.connector = instance.getConnector(this.username, this.password.getBytes());
    
    TableOperations tops = this.connector.tableOperations();
    if (!tops.exists(this.tableName)) {
        tops.create(this.tableName);
        
        IteratorSetting combiner = new IteratorSetting(19, "summation", org.apache.accumulo.core.iterators.user.SummingCombiner.class);
        combiner.addOption("all", "true");
        combiner.addOption("lossy", "true");
        combiner.addOption("type", "VARLEN");
        
        tops.attachIterator(tableName, combiner);
    }

    this.writer = this.connector.createBatchWriter(this.tableName, 10000000l, 10000l, 8);
  }
  
  /**
   * For RabbitMQ configuration, create the channel to create the queue on, and then bind
   * it to the correct exchange.
   * @throws IOException
   */
  protected void setupAmqp() throws IOException {
    // Create the Channel
    ConnectionFactory connFactory = new ConnectionFactory();
    connFactory.setHost(this.hostName);
    Connection conn = connFactory.newConnection();
    this.channel = conn.createChannel();
    
    channel.exchangeDeclare(this.exchangeName, "direct");
    String queueName = channel.queueDeclare().getQueue();

    // Bind that queue to the exchange Node will be writing to in RabbitMQ
    channel.queueBind(queueName, this.exchangeName, this.sendRoutingKey);
    channel.queueBind(queueName, this.exchangeName, this.getRoutingKey);
    

    // Make said consumer for the queue
    this.consumer = new QueueingConsumer(channel);
    channel.basicConsume(queueName, false, this.consumer);
  }
  
  /**
   * @return the done
   */
  public boolean isDone() {
    return done;
  }

  /**
   * @param done the done to set
   */
  public void setDone(boolean done) {
    this.done = done;
  }

  /**
   * Run until told to stop running via {@link done}
   */
  public void run() {
    while (!done) {
      QueueingConsumer.Delivery delivery;
      AnalyticData data;
      
      try {
        delivery = consumer.nextDelivery();
        String routingKey = delivery.getEnvelope().getRoutingKey();
        
        BasicProperties props = delivery.getProperties();
        
        BasicProperties replyProps = new BasicProperties();
        replyProps.setCorrelationId(props.getCorrelationId());
        
        if (routingKey.equals(this.sendRoutingKey)) {
          System.out.println("Got the key: " + this.sendRoutingKey);
          data = gson.fromJson(new String(delivery.getBody()), AnalyticData.class);
          
          System.out.println("Received data to load: " + data);
          
          handleData(data);
        } else if (routingKey.equals(this.getRoutingKey)) {
          System.out.println("Got the key: " + this.getRoutingKey);
          
          data = gson.fromJson(new String(delivery.getBody()), AnalyticData.class);
          
          System.out.println("Received data to fetch: " + data);
          
          List<AnalyticData> results = getResults(data);
          
          System.out.println("Returning " + results.size() + " elements");
          
          this.channel.basicPublish(this.exchangeName, this.getResponseRoutingKey, replyProps, gson.toJson(results).getBytes());
        } else {
          System.out.println("Received unknown routing key");
        }
        
        channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);

      } catch (ShutdownSignalException e) {
        System.out.println("Caught ShutdownSignalException, stopping...");
        e.printStackTrace();
        done = true;
      } catch (InterruptedException e) {
        System.out.println("Caught InterruptedException, stopping...");
        e.printStackTrace();
        done = true;
      } catch (IOException e) {
        System.out.println("Caught IOException, ignoring...");
        e.printStackTrace();
      }
    }
    
    try {
      this.writer.close();
    } catch (MutationsRejectedException e) {
      // TODO Auto-generated catch block
      e.printStackTrace();
    }
    
    System.out.println("Exiting...");
  }
  
  /**
   * Convert the data into Mutations and write it into Accumulo
   * @param data
   */
  protected void handleData(AnalyticData data) {
    // A naive key structure that is efficient to find all
    // hits for a given host
    Mutation m = new Mutation(data.getHost());
    
    cfHolder.set(data.getVisitor().getBytes());
    cqHolder.set(Long.toString(data.getArrival()));
    
    m.put(cfHolder, cqHolder, SINGLE_VALUE);
    
    try {
      writer.addMutation(m);
    } catch (MutationsRejectedException e) {
      System.err.println("Could not create mutation for data: " + data);
    }
  }
  
  protected List<AnalyticData> getResults(AnalyticData input) {
    List<AnalyticData> results = new ArrayList<AnalyticData>();
    
    BatchScanner bs;
    try {
      bs = connector.createBatchScanner(this.tableName, Constants.NO_AUTHS, 4);
    } catch (TableNotFoundException e) {
      return Collections.emptyList();
    }
    
    bs.setRanges(Collections.singletonList(new Range(input.getHost())));
    
    for (Entry<Key,Value> entry : bs) {
      Key k = entry.getKey();
      results.add(new AnalyticData(k.getRow().toString(), k.getColumnFamily().toString(),
          Long.parseLong(k.getColumnQualifier().toString())));
    }
    
    return results;
  }
  
  public static void main(String[] args) throws AccumuloException, AccumuloSecurityException, IOException, TableExistsException, TableNotFoundException {
    final AmqpWebAnalytics analytics = new AmqpWebAnalytics();
    
    final Thread t = new Thread(analytics);
    
    t.run();
    
    Runtime.getRuntime().addShutdownHook(new Thread() {
      public void run() { 
        try {
          // (Attempt to) let it exit gracefully
          analytics.setDone(true);
          
          // Make sure it closed
          analytics.writer.close();
          
          t.join(5000);
        } catch (InterruptedException e) {
          e.printStackTrace();
        } catch (MutationsRejectedException e) {
          // TODO Auto-generated catch block
          e.printStackTrace();
        }
      }
    });
    
    while (t.isAlive()) {
      try {
        Thread.sleep(5000);
      } catch (InterruptedException e) {
        e.printStackTrace();
        return;
      }
    }
  }
}
