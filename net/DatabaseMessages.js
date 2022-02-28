"use strict";
const createLogger = require('logging').default;
const logger = createLogger('DatabaseMessages');

const Areas = require('../global/Areas.js');
const Stats = require('../global/Stats.js');

server.handleMessage("login", async (client, args) => {
    const username = args.user;
    const password = args.pass;
    const game = args.game;

    if (username === undefined) {
        client.kick("Missing username parameter!");
        return;
    } else if (password === undefined) {
        client.kick("Missing password parameter!");
        return;
    } else if (game === undefined) {
        client.kick("Missing game parameter!");
        return;
    }

    const games = ["football", "baseball"];
    if (!games.includes(game)) {
        client.kick("Game not supported.");
        return;
    }
    client.game = game;

    const user = await database.getUser(username, password, game);
    if (user.error) {
        client.send("login_resp", {error_code: user.error,
                                   id: 0,
                                   response: user.message});
        return;
    }

    // Kick the other clients out if they're logged in
    // as the same user.
    process.send({cmd: 'kick',
                  userId: user.id,
                  type: 901,
                  reason: "You have been disconnected because someone else just logged in using your account on another computer."});

    // We finish setting up the login details at the end of the event loop
    // to prevent ourselves from getting kicked out after logging in.
    setTimeout(() => {
        client.userId = user.id;
        client.send("login_resp", {error_code: 0,
                                   id: user.id,
                                   response: "All ok"});

    }, 50);
});

server.handleMessage("login_token", async (client, args) => {
    const token = args.token;
    const game = args.game;

    if (token === undefined) {
        client.kick("Missing token");
        return;
    } else if (game === undefined) {
        client.kick("Missing game");
        return;
    }

    const games = ["football", "baseball"];
    if (!games.includes(game)) {
        client.kick("Game not supported.");
        return;
    }
    client.game = game;

    const user = await database.getUserWithToken(token, game);
    if (user.error) {
        client.send("login_resp", {error_code: user.error,
                                   id: 0,
                                   response: user.message});
        return;
    }

    // Kick the other clients out if they're logged in
    // as the same user.
    process.send({cmd: 'kick',
                  userId: user.id,
                  type: 901,
                  reason: "You have been disconnected because someone else just logged in using your account on another computer."});

    // We finish setting up the login details at the end of the event loop
    // to prevent ourselves from getting kicked out after logging in.
    setTimeout(() => {
        client.userId = user.id;
        client.send("login_resp", {error_code: 0,
                                   id: user.id,
                                   response: "All ok"});

    }, 50);

});

server.handleMessage('get_profile', async (client, args) => {
    let userId = args.user_id;
    if (userId === undefined) {
        // Must be self.
        userId = client.userId;
    }
    const user = await redis.getUserById(userId, client.game);
    if (Object.keys(user).length == 0)
        return;

    const profile = [user.icon].concat(user.stats);
    client.send("profile_info", {profile: profile});
});

server.handleMessage('set_icon', async (client, args) => {
    const icon = args.icon;
    if (client.userId == 0) {
        client.kick("Attempting to set icon without logging in first.");
        return;
    } else if (icon === undefined) {
        logger.warn("Got set_icon with missing icon!  Ignoring.");
        return;
    }

    await database.setIcon(client.userId, icon);
});

server.handleMessage('locate_player', async (client, args) => {
    const username = args.user;
    if (client.userId == 0) {
        client.kick("Attempting to locate player without logging in first.");
        return;
    } else if (username == undefined) {
        logger.warn("Got locate_user without username set.  Ignoring.");
        return;
    }

    const response = {code: 0,
                      areaId: 0,
                      area: ""};

    const user = await redis.getUserByName(username);
    if (!user || !user.game || user.game != client.game) {
        // Player not logged in or in the different game
        client.send("locate_resp", response);
        return
    }

    if (!user.area) {
        // Logged in but not in an area.
        response.code = 4;
    } else if (user.inGame) {
        response.code = 2;
    } else {
        response.code = 1;
        response.areaId = user.area;
        response.area = Areas.Areas[user.area] || `Unknown area (${user.area})`;
    }

    client.send("locate_resp", response);
});

server.handleMessage("game_results", async (client, args) => {
    const resultsUserId = args.user;
    const reportingUserId = client.userId;
    let isHome;
    let opponentId;
    // The home team always reports the game results, so we can use that
    // to tell whether the results are for the home or away team.
    // TODO: Verify that this is true for football (it is for baseball)
    if (reportingUserId == resultsUserId) {
        isHome = 1;
        opponentId = client.opponentId;
    } else {
        isHome = 0;
        opponentId = client.userId;
    }
    const resultsFields = args.fields;
    const ongoingResults = Stats.ResultsMappers[client.game](
        resultsFields, isHome, opponentId
    );
    await redis.setOngoingResults(resultsUserId, client.game, ongoingResults);
});
