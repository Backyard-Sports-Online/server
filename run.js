"use strict"

const yaml         = require('js-yaml');
const fs           = require('fs');
const createLogger = require('logging');
const cluster      = require('cluster');

// Read the configuration files.
const config = yaml.load(fs.readFileSync('config.yaml'));
const credientals = yaml.load(fs.readFileSync('credentials.yaml'));

if (cluster.isMaster) {
    // Fork out workers
    for (let i = 0; i < (config['cores'] || 1); i++) {
        const env = {};
        if (i == 0) {
            env.FIRST_WORKER = true;
        }
        const worker = cluster.fork(env);
        worker.on('message', (message) => {
            for (const id in cluster.workers) {
                cluster.workers[id].send(message);
            }
        });
    }
} else {
    // Worker
    const NetworkListener = require('./net/NetworkListener');
    const Redis = require('./database/Redis');

    global.server = new NetworkListener(config['network'])
    global.redis = new Redis(credientals['redis']);
    if (credientals.web) {
        const WebAPI = require('./database/WebAPI');
        global.database = new WebAPI(credientals['web']);
    } else {
        global.database = global.redis;
    }

    // Load message functions
    require('./net/DatabaseMessages.js');
    require('./net/AreaMessages.js');
    require('./net/ChallengeMessages.js');
    require('./net/SessionMessages.js');

    // Handle messages from other processes.
    process.on('message', (message) => {
        const cmd = message.cmd;
        delete message.cmd;
        process.emit(cmd, message);
    });
}
