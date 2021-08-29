"use strict";
const createLogger = require('logging').default;
const net = require('net');

const NetworkConnection = require('./NetworkConnection');

class NetworkListener {
    constructor(config) {
        this.logger = createLogger('NetworkListener');
        this.config = config;
        this.connections = new Set();

        // message: function
        // Add new messages with server.handleMessage.
        this.messages = {
            'heartbeat': (client, args) => {
                client.receivedHeartbeat = true;
                client.heartbeatTimer.refresh();
            },
            'disconnect': async (client, args) => {
                await this.handleDisconnect(client);
            }
        };

        const host = this.config['host'];
        const port = Number(this.config['port']);

        this.server = net.createServer((socket) => {
            this.logger.debug('Got incoming connection from ' + socket.remoteAddress + ':' + socket.remotePort);
            socket.setEncoding('utf-8');
            this.connections.add(new NetworkConnection(socket))

        });
        this.server.listen(port, host, () => {
            this.logger.info('Now listening for TCP connections on ' + host + ':' + port);
        });

        process.on("kick", (args) => {
            const userId = args.userId;
            const type = args.type;
            const reason = args.reason;
            if (!userId) {
                this.logger.warn("Received kick message without user id!  Ignoring.");
                return;
            }
            for (const client of this.connections) {
                if (client.userId == userId) {
                    client.kick(type, reason);
                    break;
                }
            }
        });

    }

    handleMessage(message, func) {
        this.messages[message] = func;
    }

    async handleDisconnect(client, lost = false) {
        if (client.terminated) return;
        client.terminated = true;
        clearTimeout(client.heartbeatTimer);

        if (client.userId && client.areaId) {
            await redis.removeUserFromArea(client.userId, client.areaId, client.game);
        }
        if (client.userId) {
            await redis.removeUser(client.userId, client.game);
        }

        this.connections.delete(client);
        client.socket.end();
    }

}

module.exports = NetworkListener;
