node-accumulo
=============

This project uses node.js to ingest into Apache Accumulo via RabbitMQ and a Java application. The intent is to store records of a client visiting a website, much like a Google Analytics. This example is meant to be contrived and the intent is to show the potential of using node to (indirectly) ingest data into Apache Accumulo. 

### Brief Summary

[node.js][] runs an HTTP webserver which accepts incoming requests from an HTTP client. Upon receipt, it strips the intended information off the query string of the request URL and fires a JSON string over RabbitMQ. Meanwhile, a Java process is running in the background, pulling data off of a queue that the node server is writing to. Upon receipt of a message, the Java process converts the JSON string into an object, creates, and then inserts mutations into Accumulo corresponding to the data contained in the JSON string.

### Prerequisites

I'll make the (bold) assumption that you already have [Apache Hadoop][], [Apache Zookeeper][], and [Apache Accumulo][] installed on your machine. There is good documentation elsewhere for this.

#### RabbitMQ and node.js

These should be relatively straightfoward, something along the lines of:

    # emerge net-misc/rabbitmq-server net-libs/nodejs

Otherwise, you can manually install both [RabbitMQ][] and [node.js][]. Don't forget to start RabbitMQ.

    # /etc/init.d/rabbitmq start

#### Display

[Express][], [Jade][], [Socket.IO][], and [DataTables][] were used to create an simple interface for users to view data stored in Accumulo.

#### Running the application

Make sure you have Hadoop, Zookeeper, and Accumulo started, then install the dependencies for the application and start it.

    $ cd node
    $ npm install
    $ NODE_ENV=production node node/server.js

Build and run the AmqpWebAnalytics class

    $ cd java/webanalytics
    $ mvn package
    $ bin/run.sh

Fire up curl to load some data

    $ curl http://localhost:3000/analytics/10.0.0.1 -d "visitor=10.0.0.2"
    $ curl http://localhost:3000/analytics/10.0.0.1 -d "visitor=10.0.0.3"
    $ curl http://localhost:3000/analytics/10.0.0.1 -d "visitor=10.0.0.4"

Use the site to view the data at http://localhost:3000. You can also open up the Accumulo shell to verify that the record exists.

![Screenshot](http://joshelser.github.com/images/screenshot.png")


    root@accumulo analytics> scan
    10.0.0.1 10.0.0.2:1335928232348 []
    10.0.0.1 10.0.0.3:1335928232353 []
    10.0.0.1 10.0.0.4:1335928232358 []

#### Having fun

If you really want to test out the server, try running siege to flood the process :D

    # emerge -av app-benchmarks/siege
    $ siege.config
    $ siege -b -c 800 "http://localhost:3000/analytics/10.0.0.1 POST visitor=10.0.0.2"

[RabbitMQ]: http://www.rabbitmq.com/ "RabbitMQ"
[node.js]: http://nodejs.org/       "node.js"
[node-amqp-module]: https://github.com/postwait/node-amqp "node-amqp module"
[Apache Hadoop]: http://hadoop.apache.org/common/docs/r0.20.2/quickstart.html#PseudoDistributed "Apache Hadoop"
[Apache Zookeeper]: http://zookeeper.apache.org/doc/r3.3.1/zookeeperStarted.html "Apache Zookeeper"
[Apache Accumulo]: http://accumulo.apache.org/1.4/user_manual/Administration.html "Apache Accumulo"
[Express]: http://expressjs.com/ "Express"
[Jade]: http://jade-lang.com "Jade"
[Socket.IO]: http://socket.io "Socket.IO"
[DataTables]: http://datatables.net "DataTables"
