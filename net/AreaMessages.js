"use strict";
const createLogger = require('logging').default;
const logger = createLogger('AreaMessages');

const Areas = require('../global/Areas.js');

server.handleMessage('get_population', async (client, args) => {
    const areaId = args.area;
    if (areaId === undefined) {
        logger.warn('Got get_population message without area id!  Ignoring.');
        return;
    }

    let population = 0;
    if (areaId in Areas.Groups) {
        for (const area of Areas.Groups[areaId]) {
            const users = await redis.getUserIdsInArea(area, client.game);
            population += users.length;
        }
    } else {
        population = (await redis.getUserIdsInArea(areaId, client.game)).length;
    }
    client.send('population_resp', {area: areaId, population: population});

});

server.handleMessage('enter_area', async (client, args) => {
    const areaId = args.area;
    if (areaId === undefined) {
        logger.warn('Got enter_area message without area id!  Ignoring.');
        return;
    }
    if (areaId == 33) {
        // HACK
        return;
    }
    client.areaId = areaId;
    await redis.addUserToArea(client.userId, areaId, client.game);
});

server.handleMessage('leave_area', async (client, args) => {
    if (!client.areaId) {
        // this.logger.error("Got leave_area without being in an area!");
        return;
    }
    const oldAreaId = client.areaId;
    client.areaId = 0;
    client.sliceStart = 0;
    client.sliceEnd = 0;
    await redis.removeUserFromArea(client.userId, oldAreaId, client.game);
});

server.handleMessage('get_players', async (client, args) => {
    const start = args.start;
    const end = args.end + 1;

    if (!client.areaId) {
        logger.warn("Got get_players without being in an area!");
        return;
    }

    client.sliceStart = start;
    client.sliceEnd = end;

    const users = await redis.getUsersInArea(client.areaId, client.game);

    const players = [];
    for (const user of users) {
        if (user.id == client.userId) {
            // Don't add ourselves in.
            continue;
        }
        // TODO: Fix this
        players.push([user.user, user.id, user.icon, 0, 0, 0, user.phone, user.opponent]);
    }
    client.send('players_list', {players: players.slice(client.sliceStart, client.sliceEnd)});

});

process.on('update_players_list', (args) => {
    const areaId = args.area;
    const game = args.game;
    const users = args.users;

    for (const client of server.connections) {
        if (client.areaId == areaId && client.game == game) {
            const players = [];
            for (const user of users) {
                if (user.id == client.userId) {
                    // Don't add ourselves in.
                    continue;
                }
                // TODO: Fix this
                players.push([user.user, user.id, user.icon, 0, 0, 0, user.phone, user.opponent]);
            }
            client.send('players_list', {players: players.slice(client.sliceStart, client.sliceEnd)});
        }
    }
});

server.handleMessage('game_started', async (client, args) => {
    const playerId = args.user;

    await redis.setInGame(client.userId, 1);
    await redis.setInGame(playerId, 1);

    await redis.sendUsersInArea(client.areaId, client.game);
    await redis.sendGamesPlayingInArea(client.areaId, client.game);
});

server.handleMessage('game_finished', async (client, args) => {
    await redis.setInGame(client.userId, 0);
    await redis.sendGamesPlayingInArea(client.areaId, client.game);

    // Get the most recent results data
    const finalResultsAsStrings = await redis.getOngoingResults(client.userId, client.game);
    const finalResults = Object.fromEntries(
        Object.entries(finalResultsAsStrings).map(([k, stat]) => [k, Number(stat)])
    );
    const homeRuns = finalResults.hits - (finalResults.singles + finalResults.doubles + finalResults.triples);
    const winSign = finalResults.winning * 2 - 1;

    // Then get this user's existing baseball stats
    let stats = await redis.getStats(client.userId, client.game);
    stats.wins += finalResults.winning;  // Increment user's wins
    stats.losses += (1 - finalResults.winning);  // Increment user's losses
    if (Math.sign(stats.streak) == winSign) {
        // If user is continuing their streak, increment/decrement it.
        stats.streak += winSign;
    } else {
        // If user is starting a new streak.
        stats.streak = winSign;
    }
    // TODO (maybe): Wins in last 10 games and margin
    stats.games += 1;
    stats.atBats += finalResults.atBats;
    stats.hits += finalResults.hits;
    stats.singles += finalResults.singles;
    stats.doubles += finalResults.doubles;
    stats.triples += finalResults.triples;
    stats.homeRuns += homeRuns;
    stats.steals += finalResults.steals;
    stats.strikeouts += finalResults.strikeouts;
    stats.walks += finalResults.walks;
    stats.longestHomeRun = Math.max(statslongestHomeRun, finalResults.longestHomeRun);

    await redis.setStats(client.userId, client.game, stats);
});

process.on('update_games_playing', async (args) => {
    const areaId = args.area;
    const game = args.game;
    const gamesPlaying = args.games;

    for (const client of server.connections) {
        if (client.areaId == areaId && client.game == game) {
            client.send('games_playing', {games: gamesPlaying});
        }
    }
});
