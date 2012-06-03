var express = require('express'),
    routes = require('./routes'),
    amqp = require('amqp'),
    io = require('socket.io'),
    util = require('util');

// Make the express app
var app = module.exports = express.createServer();

// Where we'll listen for HTTP messages
var SERVER_PORT = 12345;
var SERVER_NAME = 'localhost';

// The RabbitMQ exchange we'll write to
var EXCHANGE_NAME = 'accumuloanalytics';
var SEND_KEY = 'webanalytics-post';
var GET_KEY = 'webanalytics-get';
var RESPONSE_GET_KEY = 'webanalytics-response-get';
var RECEIVE_QUEUE_NAME = 'receiveaccumuloanalytics';

// Make the AMQP connection
var connection = amqp.createConnection({url : 'amqp://guest:guest@localhost:5672'});
var exchange = null;
var receive_queue = null;

// Express configuration
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes

// Allow users to query for data
app.get('/', function(req, res) {
    res.render('index', {title: 'Accumulo, RabbitMQ, node.js'});
});

// Allow users to submit new data
app.post('/analytics/:host', function(req, res) {
    var visitor = req.body.visitor;
    if (visitor) {
        // Submit the record
        send_message(req.params.host, req.body.visitor);

        res.send("Submitting record that " + req.body.visitor + 
            " visited " + req.params.host);
    } else {
        res.send("Who visited " + req.params.host + "?? Provide a visitor in the body!");
    }
});

// Fire a JSON representation of the hit to the exchange
function send_message(host, visitor) {
    var message = JSON.stringify({'host':host, 'visitor':visitor, 'arrival': (new Date()).getTime()});

    //console.log("Sending message to rabbitmq: " + message);

    exchange.publish(SEND_KEY, message);

    //console.log("Message sent");
}

// Fire a JSON representation of the hit to the exchange
function get_message(host) {
    var message = JSON.stringify({'host':host});

    //console.log("Sending message to rabbitmq: " + message);

    exchange.publish(GET_KEY, message);

    //console.log("Message sent");
}

// What to do when we get a response on socket.io
function socket_response(client) {
    //console.log("Got a socket connection");

    // The client sends this one to node
    client.on('fetch_host', function(msg) {
        get_message(msg);
    });

    // The callback to return the data back to the client from Accumulo
    receive_queue.subscribe({ack:true}, function(message) {
        var data = message['data'].toString();

        client.emit('response', data);

        receive_queue.shift();
    });
}

// Start the http server
connection.on('ready', function() {
    console.log("connected to " + connection.serverProperties.product);

    // Make the exchange
    exchange = connection.exchange(EXCHANGE_NAME, {type: 'direct', durable: false, exclusive: false, autoDelete: false},
        function() {
            console.log("exchange connected");
        });

    // And wait for the exchange to be established
    exchange.on("open", function() {

        // Define a queue that the Java proc is expecting
        receive_queue = connection.queue(RECEIVE_QUEUE_NAME, {}, function() {});

        // Wait for the queue to open
        receive_queue.on("open", function() {

            receive_queue.bind(EXCHANGE_NAME, RESPONSE_GET_KEY);

            receive_queue.on("queueBindOk", function() {

                // Start up the express app and then socket.io
                app.listen(3000, function(){
                    console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
                    var socket = io.listen(app);

                    socket.on('connection', socket_response);
                });
            });
        });
    });
});
