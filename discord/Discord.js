"use strict";

const createLogger = require('logging').default;
const { Client, Intents, MessageEmbed } = require('discord.js');
const { Areas, Groups } = require('../global/Areas.js');

class Discord {
  constructor(config) {
    this.logger = createLogger("Discord");

    this.sentOffline = false;

    this.client = new Client({intents: [Intents.FLAGS.GUILDS]});
    this.client.once('ready', async () => {
      this.logger.info("Connected.");
      this.channel = await this.client.channels.fetch(config['channel']);
      let messages = await this.channel.messages.fetch();
      messages = messages.filter(m => m.author.id === config['client']);
      if (messages.first())
        this.lastMessageId = messages.first().id;
      this.logger.info("Now sending population.");
      await this.sendPopulation();

      // Set a timeout
      this.populationTimer = setTimeout(async () => {
        await this.sendPopulation();
        this.populationTimer.refresh();
      }, 60000);

    });

    this.client.login(config['token']);
  }

  async sendPopulation() {
    let usersOnline = 0;
    let gamesPlaying = 0;

    let baseballUsers = '';
    let footballUsers = '';

    const userIds = Object.values(await redis.redis.hgetall("byonline:users:nameToId")).map(Number);
    for (const userId of userIds) {
      const user = await redis.getUserById(userId);
      if (user === {} || !user.game)
        // Not logged in.
        continue;

      usersOnline++;
      if (user.inGame)
        gamesPlaying += .5;

      let area = "(Online)";
      let groupName = "";
      if (user.area) {
        const groups = Object.values(Groups);
        if (groups[0].includes(user.area))
          groupName = "Easy Street";
        else if (groups[1].includes(user.area))
          groupName = "Mediumville";
        else if (groups[2].includes(user.area))
          groupName = "Toughy Town";

        area = `${user.inGame ? '(In-Game) ' : ''}(${Areas[user.area]}, ${groupName})`;
      }
      if (user.game == "baseball") {
        baseballUsers += `${user.user} ${area}\n`;
      } else {
        footballUsers += `${user.user} ${area}\n`;
      }
    }

    const embed = new MessageEmbed()
      .setTitle('Server Population:')
      .setFooter("Updates every minute.")
      .setColor("GREY")
      .setTimestamp();

    if (!usersOnline)
      embed.setDescription("No one is currently online. :(");
    else {
      embed.setDescription(`Total Population: ${usersOnline}\nGames Currently Playing: ${Math.floor(gamesPlaying)}`);
      if (baseballUsers)
        embed.addField("Backyard Baseball 2001", baseballUsers);
      if (footballUsers)
        embed.addField("Backyard Football", footballUsers);
    }

    if ((!usersOnline && !this.sentOffline) || usersOnline) {
      if (this.lastMessageId) {
        const message = await this.channel.messages.fetch(this.lastMessageId)
        await message.edit({ embeds: [embed] });
      } else {
        const message = await this.channel.send({ embeds: [embed] });
        this.lastMessageId = message.id;
      }
      if (!usersOnline)
        this.sentOffline = true;
      else
        this.sentOffline = false;
    }
  }
}

module.exports = Discord;
