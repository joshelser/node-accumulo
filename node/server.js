var url = require('url'),
    http = require('http'),
    amqp = require('amqp'),
    util = require('util');

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

var response = null;

var http_server = http.createServer(function(request, response) {
    console.log('Got HTTP request');
    var parsed_url = url.parse(request.url, true);
    var path = parsed_url['pathname'];

    if (path == '/post') {
        console.log('/post');
        process_post(response, parsed_url['query']);
    } else if (path == '/get') {
        console.log('/get');
        process_get(response, parsed_url['query']);
    } else {
        console.log('Ignoring request');
        response.writeHead(200, {'Content-Type': 'text/plain'});
        response.end('Try /post or /get');
    }

    console.log('Finished request');

    request.on('end', function() { console.log("request ended"); });
});

// Do some basic validation of the query string before proceeding
function process_post(response, query) {
    if ('host' in query && 'visitor' in query) {
        var host = query['host'];
        var visitor = query['visitor'];

        send_message(host, visitor);

        response.writeHead(200, {'Content-Type': 'text/plain'});
        response.end('');
    } else {
        response.writeHead(400, {'Content-Type': 'text/plain'});
        response.end("'host' and 'visitor' must be specified");
    }
}

// Do some basic validation of the query string before proceeding
function process_get(response, query) {
    if ('host' in query) {
        var host = query['host'];
        console.log('Sending host: ' + host);

        receive_queue.subscribe( {ack:true}, function(message) {
            console.log("Got the data from the queue: " + message['data']);
            response.writeHead(200, {'Content-Type': 'text/plain'});
            response.end(message['data']);
            console.log('Wrote out the response');
            receive_queue.shift();
        });


        console.log('Sending message');
        get_message(host);
        //response.writeHead(200, {'Content-Type': 'text/plain'});
        //response.end("got it");
    } else {
        response.writeHead(400, {'Content-Type': 'text/plain'});
        response.end("'host' and 'visitor' must be specified");
    }
}

// Fire a JSON representation of the hit to the exchange
function send_message(host, visitor) {
    var message = JSON.stringify({'host':host, 'visitor':visitor, 'arrival': (new Date()).getTime()});
    console.log("Sending message to rabbitmq: " + message);
    exchange.publish(SEND_KEY, message);
}

// Fire a JSON representation of the hit to the exchange
function get_message(host, visitor) {
    var message = JSON.stringify({'host':host});
    console.log("Sending message to rabbitmq: " + message);
    exchange.publish(GET_KEY, message);
}


connection.on('ready', function() {
    console.log("connected to " + connection.serverProperties.product);

    // Make the exchange
    exchange = connection.exchange(EXCHANGE_NAME, {type: 'direct', durable: false, exclusive: false, autoDelete: false}, function() {
        console.log("exchange connected");
    });

    exchange.on("open", function() {
        console.log("exchange open");
        receive_queue = connection.queue(RECEIVE_QUEUE_NAME, {}, function() {});
        receive_queue.on("open", function() {
            console.log("queue open");
            receive_queue.bind(EXCHANGE_NAME, RESPONSE_GET_KEY);
            receive_queue.on("queueBindOk", function() {
                console.log("queue bound");

                http_server.listen(SERVER_PORT, SERVER_NAME);
            });
        });
    });
});
