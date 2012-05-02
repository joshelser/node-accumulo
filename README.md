node-accumulo
=============

This project uses node.js to ingest into Apache Accumulo via RabbitMQ and a Java application. Node.js runs an HTTP webserver which accepts incoming requests. Upon receipt, it fires a message over RabbitMQ where a Java process is running in the background. The Java process pulls the message off of its queue, and creates/inserts the mutation into Accumulo

### Prerequisites

I'll make the bold assumption that you already have [Apache Hadoop][], [Apache Zookeeper][], and [Apache Accumulo][] installed on your machine. There is good documentation elsewhere for this.

#### RabbitMQ and node.js

These should be relatively straightfoward, something along the lines of:

    # emerge net-misc/rabbitmq-server net-libs/nodejs

Otherwise, you can manually install both [RabbitMQ][] and [node.js][]. Don't forget to start RabbitMQ.

    # /etc/init.d/rabbitmq start

#### node-amqp-module

Things get a little tricky with the [node-amqp-module][]. The version of the module pulled down using npm was old so I had to pull down the code manually, build the module, and tell node about the path

    $ git clone https://github.com/postwait/node-amqp.git node-amqp.git
    $ cd node-amqp.git && make
    $ export NODE_PATH=$NODE_PATH:/path/to/node-amqp.git

#### Running

Make sure you have Hadoop, Zookeeper, and Accumulo started, then start the node process

    $ node node/server.js

Build and run the AmqpWebAnalytics class

    $ cd java/webanalytics
    $ mvn package
    $ bin/run.sh

Then, fire up curl and request the URL

    $ curl "http://localhost:12345/?host=10.0.0.1&visitor=10.0.0.2"

At this point, you should have a print statement from both the node and Java process acknowledging that they both received the message, and, you should also see a new entry in a new Accumulo table with the information you provided, similar to:

    root@accumulo analytics> scan
    10.0.0.1 10.0.0.2:1335928232348 []

[RabbitMQ]: http://www.rabbitmq.com/ "RabbitMQ"
[node.js]: http://nodejs.org/       "node.js"
[node-amqp-module]: https://github.com/postwait/node-amqp "node-amqp module"
[Apache Hadoop]: http://hadoop.apache.org/common/docs/r0.20.2/quickstart.html#PseudoDistributed "Apache Hadoop"
[Apache Zookeeper]: http://zookeeper.apache.org/doc/r3.3.1/zookeeperStarted.html "Apache Zookeeper"
[Apache Accumulo]: http://accumulo.apache.org/1.4/user_manual/Administration.html "Apache Accumulo"
