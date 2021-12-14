"use strict";
const createLogger = require('logging').default;
const bent = require('bent');
const Stats = require('../global/Stats.js');

class WebAPI {
    constructor(config) {
        this.logger = createLogger('WebAPI');

        this.token = config['token'];

        const endpoint = config['endpoint'];
        this.get = bent(endpoint, 'GET', 'json', 200);
        this.post = bent(endpoint, 'POST', 'json', 200);
    }

    async getUser(username, password, game) {
        return {error: 1, message: "Web API does not support dev logins."};
    }

    async getUserWithToken(token, game) {
        const user = await this.post('/get_profile', {token: this.token,
                                                      login_token: token,
                                                      game: game});
        if (user.error) {
            return user;
        }
        // Store the user into the Redis cache
        redis.addUser(user.id, {user: user.user,
                                icon: user.icon,
                                stats: user.stats}, game);
        return user;
    }

    async setIcon(userId, icon) {
        const response = await this.post('/set_icon', {token: this.token,
                                                      userId: userId,
                                                      icon: icon});
        if (response.error) {
            this.logger.error("Failed to set icon!", { response });
            return;
        }

        // Set the icon in the Redis cache.
        redis.setIcon(userId, icon);
    }

    async setStats(userId, game, stats) {
        this.logger.info("SENDING STATS FOR " + userId + " TO SITE: " + JSON.stringify(stats));
        const response = await this.post('/set_stats', {
            token: this.token,
            userId: userId,
            game: game,
            stats: stats,
        })

        if (response.error) {
            this.logger.error("Failed to set stats!", { response });
            return;
        }
    }

    async getStats(userId, game) {
        this.logger.info("GETTING STATS FOR " + userId + " FROM SITE");
        const response = await this.get('/get_stats', {
            token: this.token,
            userId: userId,
            game: game,
        })
        this.logger.info(JSON.stringify(response));
        let stats;
        if (response['stats']) {
            stats = response['stats'];
        } else {
            this.logger.info("SETTING DEFAULT STATS");
            await this.setStats(userId, game, Stats.DefaultStats[game]);
            stats = Stats.DefaultStats[game];
        }
        return stats;
    }
}

module.exports = WebAPI;
