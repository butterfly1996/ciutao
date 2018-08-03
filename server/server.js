"use strict";
const HTTPS_PORT = 8443;

const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;
var url = require('url'),
    path = require('path');
// Yes, TLS is required
const serverConfig = {
    key: fs.readFileSync('../key.pem'),
    cert: fs.readFileSync('../cert.pem'),
};

// ----------------------------------------------------------------------------------------

// Create a server for the client html page

//////////////////////////////////////////////////////////////////////////////////////////
function serverHandler(request, response) {
    try {
        console.log('request received: ' + request.url);

        if(request.url === '/') {
            response.writeHead(200, {'Content-Type': 'text/html'});
            response.end(fs.readFileSync('../client/index.html'));
        } else if(request.url === '/webrtc.js') {
            response.writeHead(200, {'Content-Type': 'application/javascript'});
            response.end(fs.readFileSync('../client/webrtc.js'));
        }else if(request.url === '/index2.css') {
            response.writeHead(200, {'Content-Type': 'application/javascript'});
            response.end(fs.readFileSync('../client/index2.css'));
        }
        else{
            request.end();
        }
    } catch (e) {
        response.writeHead(404, {
            'Content-Type': 'text/plain'
        });
        response.write('<h1>Unexpected error:</h1><br><br>' + e.stack || e.message || JSON.stringify(e));
        response.end();
    }
}



const httpsServer = https.createServer(serverConfig, serverHandler);
httpsServer.listen(HTTPS_PORT, '0.0.0.0');

// ----------------------------------------------------------------------------------------

// Create a server for handling websocket calls

const wss = new WebSocketServer({server: httpsServer});

wss.on('connection', function(ws) {
    ws.on('error', () => console.log('errored'));
    ws.on('message', function(message) {
    // Broadcast any received message to all clients
    console.log('received: %s', message);
    wss.broadcast(message)
    });
        // ws.disconnect();
});
// wss.on('error', () => console.log('errored'));




wss.broadcast = function(data) {
    this.clients.forEach(function(client) {
        if(client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
    return true;
};
const ip = require('ip');
console.log('Server running. Visit https://'+ ip.address() +":"+ HTTPS_PORT + ' in Firefox/Chrome.\n\n\
Some important notes:\n\
  * Note the HTTPS; there is no HTTP -> HTTPS redirect.\n\
  * You\'ll also need to accept the invalid TLS certificate.\n\
  * Some browsers or OSs may not allow the webcam to be used by multiple pages at once. You may need to use two different browsers or machines.\n'
);
