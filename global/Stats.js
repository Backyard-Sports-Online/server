"use strict";

const StatsFormatters = {
    // These take a statistics object from redis or the site/Mongo
    // and return an array in the order that the game expects
    "baseball": (stats) => {
        const numericStats = Object.fromEntries(
            Object.entries(stats).map(([k, stat]) => [k, Number(stat)])
        );
        const statsArray = [
            numericStats.wins,
            numericStats.losses,
            numericStats.disconnects,
            numericStats.streak,
            0,
            0,
            numericStats.games,
            numericStats.atBats,
            numericStats.hits,
            0,
            numericStats.singles,
            numericStats.doubles,
            numericStats.triples,
            numericStats.homeRuns,
            0,
            numericStats.steals,
            numericStats.strikeouts,
            numericStats.walks,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            numericStats.longestHomeRun,
            0
        ];
        return statsArray;
    },
    // TODO: Football
    "football": (stats) => {
        return Array(42).fill(0)
    }
};

const ResultsMappers = {
    // These take an array that the game sends to `/game_results`
    // and return an ongoing results object that can be stored in redis
    "baseball": (resultsFields, resultsSide) => {
        const ongoingResults = {
            winning: resultsFields[0],
            runs: resultsFields[1],
            atBats: resultsFields[2],
            hits: resultsFields[3],
            errors: resultsFields[4],
            longestHomeRun: resultsFields[5],
            singles: resultsFields[6],
            doubles: resultsFields[7],
            triples: resultsFields[8],
            steals: resultsFields[9],
            strikeouts: resultsFields[10],
            walks: resultsFields[11],
            disconnect: resultsFields[12],
            completedInnings: resultsFields[13],
            side: resultsSide
        };
        return ongoingResults;
    },
    // TODO: Football
    "football": (resultsFields, resultsSide) => {
        return {"not_yet_supported": 1}
    }
};

const Aggregators = {
    // These combine a completed game's stats with that user's existing stats
    // so that the user's stats can be updated to include that game
    "baseball": (finalResults, stats) => {
        const homeRuns = finalResults.hits - (finalResults.singles + finalResults.doubles + finalResults.triples);
        // Update all of these counting stats and longest home run regardless of whether the user disconnected
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
        stats.longestHomeRun = Math.max(stats.longestHomeRun, finalResults.longestHomeRun);
        // If the user disconnected, increment those. If not, update wins, losses, and streak as normal
        if (finalResults.disconnect == 1) {
            stats.disconnects += finalResults.disconnect;
        } else {
            stats.wins += finalResults.winning;  // Increment user's wins
            stats.losses += (1 - finalResults.winning);  // Increment user's losses
            const winSign = finalResults.winning * 2 - 1;
            if (Math.sign(stats.streak) == winSign) {
                // If user is continuing their streak, increment/decrement it.
                stats.streak += winSign;
            } else {
                // If user is starting a new streak.
                stats.streak = winSign;
            }
            // TODO (maybe): Wins in last 10 games and margin (what is that exactly?)
        }
        return stats;
    },
    // TODO: Football
    "football": (finalResults, stats) => {
        return {not_yet_supported: 1}
    }
}

const DefaultStats = {
    "baseball": {
        wins: 0,
        losses: 0,
        disconnects: 0,
        streak: 0,
        games: 0,
        atBats: 0,
        hits: 0,
        singles: 0,
        doubles: 0,
        triples: 0,
        homeRuns: 0,
        steals: 0,
        strikeouts: 0,
        walks: 0,
        longestHomeRun: 0
    },
    // TODO: Football
    "football": {
        not_yet_supported: 1
    }
};

module.exports = {
    StatsFormatters: StatsFormatters,
    ResultsMappers: ResultsMappers,
    Aggregators: Aggregators,
    DefaultStats: DefaultStats
};