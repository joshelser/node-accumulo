var url = require('url'),
    http = require('http'),
    amqp = require('amqp'),
    util = require('util'),
    app = require('appserver').createServer(),
    io = require('socket.io');

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

app.get('/', function(req, res) {
    res.render('index.jade', {
        locals: {
            title: 'RabbitMQ - Accumulo Demo'
        }
    });
});

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

                app.list(3000, function() {
                    console.log('listening for connections on 3000');
                    var socket = io.listen(app);

                    socket.on('connection', function(client) {
                        console.log('Got a socket connection');

                        client.on('message', function(msg) {
                            console.log('Got a message: ' + msg);
                        });

                        client.on('disconnect', function() {
                            console.log("disconnected");
                        });

                        receive_queue.subscribe({ack:true}, function(message) {
                            console.put("subscribe - got message: " + message);
                            //client.send(message.data.toString());
                            queue.shift();
                        });
                    });
                });
            });
        });
    });
});

/*
var http_server = http.createServer(function(request, response) {
    console.log("Connection: " + response.getHeader('Connection'));
    response.setHeader('Connection', 'close');

    var connection = request.connection;

    //connection.on('drain', function() { console.log("connection was drained");});
    //connection.on('end', function() { console.log("connection was ended");});
    //connection.on('close', function() { console.log("connection was closed");});
    //connection.on('data', function() { console.log("connection was data");});
    //connection.on('error', function() { console.log("connection was errored");});

    //debugger;

    //response.on('close', function() { console.log("the response was closed");});

    //request.on('data', function() { console.log("the request got data");});
    //request.on('end', function() { console.log("the request was ended");});
    //request.on('close', function() { console.log("the request was closed");});

    console.log('Got HTTP request');
    var parsed_url = url.parse(request.url, true);
    var path = parsed_url['pathname'];

    if (path == '/post') {
        console.log('/post');
        process_post(response, parsed_url['query']);
    } else if (path == '/get') {
        console.log('/get');
        process_get(request, response, parsed_url['query']);
    } else {
        console.log('Ignoring request');
        response.writeHead(200, {'Content-Type': 'text/plain'});
        response.end('Try /post or /get');
    }

    console.log('Finished request');
    setTimeout(5000, function() {"timeout finished"});
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
function process_get(request, response, query) {
    if ('host' in query) {
        var host = query['host'];
        console.log('Sending host: ' + host);

        receive_queue.subscribe( {ack:true}, function(message) {
            console.log(util.inspect(request.connection));

            debugger;
            var data = message['data'];

            console.log("Got the data from the queue: " + data);

            response.writeHead(200, {
                'Content-Type': 'text/plain',
                'Content-Length': '8'
            });

            console.log('Wrote out the response');

            console.log("response.write return: " + response.write('response'));
            var ret = response.end('');

            if (!ret) {
                console.log("false on response.end(...)");
                response.on('drain', function() {
                    console.log("drain response");
                    response.end('');
                });
            } else {
                //request.close();
            }

            request.connection.on('drain', function() {
                console.log("drain on connection");
            });
            //console.log(util.inspect(response, false, null, true));

            receive_queue.shift();
        });


        console.log('Sending message');
        get_message(host);
        //response.writeHead(200, {'Content-Type': 'text/plain'});
        //response.end('response');
    } else {
        response.writeHead(400, {'Content-Type': 'text/plain'});
        response.end("'host' and 'visitor' must be specified");
    }

    console.log('process_get end');
}

// Fire a JSON representation of the hit to the exchange
function send_message(host, visitor) {
    var message = JSON.stringify({'host':host, 'visitor':visitor, 'arrival': (new Date()).getTime()});
    console.log("Sending message to rabbitmq: " + message);
    exchange.publish(SEND_KEY, message);
    console.log("Message sent");
}

// Fire a JSON representation of the hit to the exchange
function get_message(host, visitor) {
    var message = JSON.stringify({'host':host});
    console.log("Sending message to rabbitmq: " + message);
    exchange.publish(GET_KEY, message);
    console.log("Message sent");
}
*/

