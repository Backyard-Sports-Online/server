"use strict";

const StatsFormatters = {
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
};

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
    }
};

module.exports = {
    StatsFormatters: StatsFormatters,
    DefaultStats: DefaultStats
};