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
        players.push([user.user, user.id, user.icon, user.stats[0], user.stats[1], user.stats[2], user.phone, user.opponent]);
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
                players.push([user.user, user.id, user.icon, user.stats[0], user.stats[1], user.stats[2], user.phone, user.opponent]);
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
    const user = await redis.getUserById(client.userId);
    const finalResults = user.ongoing_results;
    if (client.game == "football") {
        // TODO: Football stats
    } else {
        // Unpack the game's results data
        let winning,                  // 1 if ahead, 0 if behind. If tied, both teams get 0
            runs,
            atBats,                   // There may be a bug where calling timeouts increments at bats
            hits,
            errors,
            longestHomeRun,           // 0 if no home runs
            singles,
            doubles,
            triples,
            steals,
            strikeouts,               // Strikeouts by this team's pitchers
            walks,                    // Walks by this team's pitchers
            quit,                     // 1 if user quit/disconnected?
            innings = finalResults;   // Number of completed innings. Value is always the same for both teams
        let homeRuns = hits - (singles + doubles + triples);
        let winSign = winning * 2 - 1;
        if (quit == 1) {
            // TODO: Handle quits/disconnects
        }
        // Then get this user's existing baseball stats
        let userStats = user.stats;
        userStats[0] += winning;  // Increment user's wins
        userStats[1] += (1 - winning);  // Increment user's losses
        if (Math.sign(userStats[3]) == winSign) {
            // If user is continuing their streak, increment/decrement it.
            userStats[3] += winSign;
        } else {
            // If user is starting a new streak.
            userStats[3] = winSign;
        }
        // userStats[4]
        // userStats[5]
        userStats[6] += 1;  // Games played
        userStats[7] += atBats;
        userStats[8] += hits;
        userStats[10] += singles;
        userStats[11] += doubles;
        userStats[12] += triples;
        userStats[13] += homeRuns;
        userStats[15] += steals;
        userStats[16] += strikeouts;
        userStats[17] += walks;
        userStats[27] = Math.max(userStats[27], longestHomeRun);

        // Update the user's stats
        await redis.updateStats(client.userId, client.game, userStats);
    }
    // Then clear out the ongoing results
    await redis.setOngoingResults(client.userId, "", "");
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
