var url = require('url'),
    http = require('http'),
    amqp = require('amqp');

// Where we'll listen for HTTP messages
var SERVER_PORT = 12345;
var SERVER_NAME = 'localhost';

// The RabbitMQ exchange we'll write to
var EXCHANGE_NAME = 'accumuloanalytics';
var ROUTING_KEY = 'webanalytic';

// Make the AMQP connection
var connection = amqp.createConnection({url : 'amqp://guest:guest@localhost:5672'});
var exchange = null;

var http_server = http.createServer(function(request, response) {
    var parsed_url = url.parse(request.url, true);

    var query = parsed_url['query'];

    process_result(response, query);
});

// Do some basic validation of the query string before proceeding
function process_result(response, query) {
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

// Fire a JSON representation of the hit to the exchange
function send_message(host, visitor) {
    var message = JSON.stringify({'host':host, 'visitor':visitor, 'arrival': (new Date()).getTime()});
    //console.log("Sending message to rabbitmq: " + message);
    exchange.publish(ROUTING_KEY, message);
}


connection.on('ready', function() {
    console.log("connected to " + connection.serverProperties.product);

    // Make the exchange
    exchange = connection.exchange(EXCHANGE_NAME, {type: 'fanout', durable: false, exclusive: false, autoDelete: false}, function() {
        console.log("exchange connected");
    });

    exchange.on("open", function() {
        http_server.listen(SERVER_PORT, SERVER_NAME);
    });
})
