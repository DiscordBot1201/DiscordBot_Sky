/**
 * Module Dependencies
 */
require("dotenv").config();
var discord = require("discord.js");
var request = require("request");
var chalk = require("chalk");
var dateFormat = require("dateformat");
var fs = require("fs");
require("log-timestamp")(() => {
  return "[" + dateFormat(new Date(), "mmm dd hh:MM:ss TT") + "]";
});
var clk = new chalk.constructor({
  enabled: true
});
cWarn = clk.bgYellow.black;
cError = clk.bgRed.black;
cDebug = clk.bgWhite.black;
cGreen = clk.bold.green;
cGrey = clk.bold.grey;
cYellow = clk.bold.yellow;
cBlue = clk.bold.blue;
cRed = clk.bold.red;
cServer = clk.bold.magenta;
cUYellow = clk.bold.underline.yellow;
cBgGreen = clk.bgGreen.black;
checkDb();
/**
 * Required Files
 */
var commands = require("./bot/commands.js");
var mod = require("./bot/mod.js");
var config = require("./bot/config.json");
var versionCheck = require("./bot/versioncheck.js");
var db = require("./bot/db.js");
checkConfig();
var lastExecTime = {};
var pmCoolDown = {};
setInterval(() => {
  lastExecTime = {};
  pmCoolDown = {};
}, 3600000);
commandsProcessed = 0;
show_warn = config.show_warn;
debug = config.debug;
var bot = new discord.Client({
  maxCachedMessages: 10,
  forceFetchUsers: true
});
bot.on("error", (m) => {
  console.log(cError(" WARN ") + " " + m);
});
bot.on("warn", (m) => {
  if (show_warn) {
    console.log(cWarn(" WARN ") + " " + m);
  }
});
bot.on("debug", (m) => {
  if (debug) {
    console.log(cDebug(" DEBUG ") + " " + m);
  }
});
bot.on("ready", () => {
  console.log(cGreen("AuthBot is ready!") + " Listening to " + bot.channels.length + " channels on " + bot.servers.length + " servers");
  versionCheck.checkForUpdate();
  setTimeout(() => {
    db.checkServers(bot);
  }, 10000);
  if (process.env.CARBON_KEY) {
    request.post({
      "url": "https://www.carbonitex.net/discord/data/botdata.php",
      "headers": {
        "content-type": "application/json"
      },
      "json": true,
      body: {
        "key": process.env.CARBON_KEY,
        "servercount": bot.servers.length
      }
    }, (err, res) => {
      if (err) {
        console.log(cError(" ERROR ") + " Error updating carbon stats: " + err);
      }
      if (res.statusCode !== 200) {
        console.log(cError(" ERROR ") + " Error updating carbon stats: Status Code " + res.statusCode);
      }
      console.log(cBgGreen(" CARBON ") + " Updated Carbon server count to " + bot.servers.length);
    });
  }
});
bot.on("disconnected", () => {
  console.log(cRed("Disconnected") + " from Discord");
  commandsProcessed = 0;
  lastExecTime = {};
  setTimeout(() => {
    console.log("Attempting to log in...");
    bot.login(process.env.token, (err, token) => {
      if (err) {
        console.log(err);
        setTimeout(() => {
          process.exit(1);
        }, 2000);
      }
      if (!token) {
        console.log(cWarn(" WARN ") + " failed to connect");
        setTimeout(() => {
          process.exit(0);
        }, 2000);
      }
    });
  });
});

bot.on("message", (msg) => {
  if (msg.author.id == bot.user.id) {
    return;
  }
  if (msg.channel.isPrivate) {
    if (/(^https?:\/\/discord\.gg\/[A-Za-z0-9]+$|^https?:\/\/discordapp\.com\/invite\/[A-Za-z0-9]+$)/.test(msg.content)) {
      bot.sendMessage(msg.author, "Use this to bring me to your server: <https://discordapp.com/oauth2/authorize?&client_id=" + process.env.APP_ID + "&scope=bot&permissions=12659727>");
    } else if (msg.content[0] !== config.command_prefix && msg.content[0] !== config.mod_command_prefix && !msg.content.startsWith("(eval) ")) {
      if (pmCoolDown.hasOwnProperty(msg.author.id)) {
        if (Date.now() - pmCoolDown[msg.author.id] > 3000) {
          if (/^(help|how do I use this\??)$/i.test(msg.content)) {
            commands.commands.help.process(bot, msg);
            return;
          }
          pmCoolDown[msg.author.id] = Date.now();
          return;
        }
      } else {
        pmCoolDown[msg.author.id] = Date.now();
        if (/^(help|how do I use this\??)$/i.test(msg.content)) {
          commands.commands.help.process(bot, msg);
          return;
        }
        return;
      }
    }
  }
  if (msg.content.startsWith("(eval) ")) {
    if (msg.author.id == process.env.ADMIN_ID) {
      evaluateString(msg);
      return;
    } else {
      bot.sendMessage(msg, "```diff\n- You do not have permission to use that command!```");
      return;
    }
  }
  if (!msg.content.startsWith(config.command_prefix) && !msg.content.startsWith(config.mod_command_prefix) && !msg.content.startsWith(bot.user.mention())) {
    return;
  }
  if (msg.content.indexOf(" ") == 1 && msg.content.length > 2) {
    msg.content = msg.content.replace(" ", "");
  }
  if (!msg.channel.isPrivate && !msg.content.startsWith(config.mod_command_prefix) && ServerSettings.hasOwnProperty(msg.channel.server.id)) {
    if (ServerSettings[msg.channel.server.id].ignore.indexOf(msg.channel.id) > -1) {
      return;
    }
  }
  var cmd = msg.content.split(" ")[0].replace(/\n/g, " ").substring(1).toLowerCase();
  var suffix = msg.content.replace(/\n/g, " ").substring(cmd.length + 2).trim();
  if (msg.content.startsWith(config.command_prefix)) {
    if (commands.commands.hasOwnProperty(cmd)) {
      execCommand(msg, cmd, suffix, "normal");
    } else if (commands.aliases.hasOwnProperty(cmd)) {
      if (!msg.channel.isPrivate) {
        db.updateTimestamp(msg.channel.server);
      }
      msg.content = msg.content.replace(/[^ ]+ /, config.command_prefix + commands.aliases[cmd] + " ");
      execCommand(msg, commands.aliases[cmd], suffix, "normal");
    }
  } else if (msg.content.startsWith(bot.user.mention())) {
    var cmdMention = msg.content.split(" ")[1].replace(/\n/g, " ").substring(0).toLowerCase();
    var mentionSuffix = msg.content.replace(/\n/g, " ").substring(cmdMention.length + 23).trim();
    if (commands.commands.hasOwnProperty(cmdMention)) {
      execCommand(msg, cmdMention, mentionSuffix, "normal");
    } else if (commands.aliases.hasOwnProperty(cmdMention)) {
      if (!msg.channel.isPrivate) {
        db.updateTimestamp(msg.channel.server);
      }
      msg.content = msg.content.replace(/[^ ]+ /, config.command_prefix + commands.aliases[cmdMention] + " ");
      execCommand(msg, commands.aliases[cmdMention], mentionSuffix, "normal");
    }
    if (mod.commands.hasOwnProperty(cmdMention)) {
      execCommand(msg, cmdMention, mentionSuffix, "mod");
    } else if (mod.aliases.hasOwnProperty(cmdMention)) {
      if (!msg.channel.isPrivate) {
        db.updateTimestamp(msg.channel.server);
        msg.content = msg.content.replace(/[^ ]+ /, config.mod_command_prefix + mod.aliases[cmdMention] + " ");
        execCommand(msg, mod.aliases[cmdMention], mentionSuffix, "mod");
      }
    }
    if (cmdMention == "reload" && msg.author.id == process.env.ADMIN_ID) {
      reload();
      bot.sendMessage(msg, "```diff\n+ Bot successfully reloaded!```");
      return;
    }
  } else if (msg.content.startsWith(config.mod_command_prefix)) {
    if (cmd == "reload" && msg.author.id == process.env.ADMIN_ID) {
      reload();
      bot.sendMessage(msg, "```diff\n+ Bot successfully reloaded!```");
      return;
    }
    if (mod.commands.hasOwnProperty(cmd)) {
      execCommand(msg, cmd, suffix, "mod");
    } else if (mod.aliases.hasOwnProperty(cmd)) {
      if (!msg.channel.isPrivate) {
        db.updateTimestamp(msg.channel.server);
        msg.content = msg.content.replace(/[^ ]+ /, config.mod_command_prefix + mod.aliases[cmd] + " ");
        execCommand(msg, mod.aliases[cmd], suffix, "mod");
      }
    }
  }
});

function execCommand(msg, cmd, suffix, type) {
  try {
    commandsProcessed += 1;
    if (type == "normal") {
      if (!msg.channel.isPrivate) {
        console.log(cServer(msg.channel.server.name) + " > " + cGreen(msg.author.username) + " > " + msg.cleanContent.replace(/\n/g, " "));
      } else {
        console.log(cGreen(msg.author.username) + " > " + msg.cleanContent.replace(/\n/g, " "));
      }
      if (msg.author.id != process.env.ADMIN_ID && commands.commands[cmd].hasOwnProperty("cooldown") && ServerSettings.hasOwnProperty(msg.channel.server.id) && ServerSettings[msg.channel.server.id].commandCooldowns === true) {
        if (!lastExecTime.hasOwnProperty(cmd)) {
          lastExecTime[cmd] = {};
        }
        if (!lastExecTime[cmd].hasOwnProperty(msg.author.id)) {
          lastExecTime[cmd][msg.author.id] = new Date().valueOf();
        } else {
          var now = Date.now();
          if (now < lastExecTime[cmd][msg.author.id] + (commands.commands[cmd].cooldown * 1000)) {
            bot.sendMessage(msg, msg.author.username.replace(/@/g, "@\u200b") + ", you need to *cooldown* (" + Math.round(((lastExecTime[cmd][msg.author.id] + commands.commands[cmd].cooldown * 1000) - now) / 1000) + " seconds)", (e, m) => {
              bot.deleteMessage(m, {
                "wait": 6000
              });
            });
            if (!msg.channel.isPrivate) {
              bot.deleteMessage(msg, {
                "wait": 10000
              });
              return;
            }
            lastExecTime[cmd][msg.author.id] = now;
          }
        }
      }
      commands.commands[cmd].process(bot, msg, suffix);
      if (!msg.channel.isPrivate && commands.commands[cmd].hasOwnProperty("deleteCommand")) {
        if (commands.commands[cmd].deleteCommand === true && ServerSettings.hasOwnProperty(msg.channel.server.id) && ServerSettings[msg.channel.server.id].deleteCommands === true) {
          bot.deleteMessage(msg, {
            "wait": 10000
          });
        }
      }
    } else if (type == "mod") {
      if (!msg.channel.isPrivate) {
        console.log(cServer(msg.channel.server.name) + " > " + cGreen(msg.author.username) + " > " + cBlue(msg.cleanContent.replace(/\n/g, " ").split(" ")[0]) + msg.cleanContent.replace(/\n/g, " ").substr(msg.cleanContent.replace(/\n/g, " ").split(" ")[0].length));
      } else {
        console.log(cGreen(msg.author.username) + " > " + cBlue(msg.cleanContent.replace(/\n/g, " ").split(" ")[0]) + msg.cleanContent.replace(/\n/g, " ").substr(msg.cleanContent.replace(/\n/g, " ").split(" ")[0].length));
      }
      if (msg.author.id != process.env.ADMIN_ID && mod.commands[cmd].hasOwnProperty("cooldown") && ServerSettings.hasOwnProperty(msg.channel.server.id) && ServerSettings[msg.channel.server.id].commandCooldowns === false) {
        if (!lastExecTime.hasOwnProperty(cmd)) {
          lastExecTime[cmd] = {};
        }
        if (!lastExecTime[cmd].hasOwnProperty(msg.author.id)) {
          lastExecTime[cmd][msg.author.id] = new Date().valueOf();
        } else {
          var now = Date.now();
          if (now < lastExecTime[cmd][msg.author.id] + (mod.commands[cmd].cooldown * 1000)) {
            bot.sendMessage(msg, msg.author.username.replace(/@/g, "@\u200b") + ", you need to *cooldown* (" + Math.round(((lastExecTime[cmd][msg.author.id] + mod.commands[cmd].cooldown * 1000) - now) / 1000) + " seconds)", (e, m) => {
              bot.deleteMessage(m, {
                "wait": 6000
              });
            });
            if (!msg.channel.isPrivate) {
              bot.deleteMessage(msg, {
                "wait": 10000
              });
              return;
            }
            lastExecTime[cmd][msg.author.id] = now;
          }
        }
      }
      mod.commands[cmd].process(bot, msg, suffix);
      if (!msg.channel.isPrivate && mod.commands[cmd].hasOwnProperty("deleteCommand")) {
        if (mod.commands[cmd].deleteCommand === true && ServerSettings.hasOwnProperty(msg.channel.server.id) && ServerSettings[msg.channel.server.id].deleteCommands === true) {
          bot.deleteMessage(msg, {
            "wait": 10000
          });
        }
      }
    } else {
      return;
    }
  } catch (err) {
    console.log(err.stack);
  }
}
bot.on("serverNewMember", (objServer, objUser) => {
  if (config.non_essential_event_listeners && ServerSettings.hasOwnProperty(objServer.id) && ServerSettings[objServer.id].welcome != "none") {
    if (!objUser.username || !ServerSettings[objServer.id].welcome || !objServer.name) {
      return;
    }
    if (debug) {
      console.log("New member on " + objServer.name + ": " + objUser.username);
    }
    bot.sendMessage(objServer.defaultChannel, ServerSettings[objServer.id].welcome.replace(/\$USER\$/gi, objUser.username.replace(/@/g, "@\u200b")).replace(/\$SERVER\$/gi, objServer.name.replace(/@/g, "@\u200b")));
  }
});
bot.on("channelDeleted", (channel) => {
  if (channel.isPrivate) {
    return;
  }
  if (ServerSettings.hasOwnProperty(channel.server.id)) {
    if (ServerSettings[channel.server.id].ignore.indexOf(channel.id) > -1) {
      db.unignoreChannel(channel.id, channel.server.id);
      if (debug) {
        console.log(cDebug(" DEBUG ") + " Ignored channel was deleted and removed from the DB");
      }
    }
  }
});
bot.on("userBanned", (objUser, objServer) => {
  if (config.non_essential_event_listeners && ServerSettings.hasOwnProperty(objServer.id) && ServerSettings[objServer.id].banAlerts === true) {
    console.log(objUser.username + cRed(" banned on ") + objServer.name);
    if (ServerSettings[objServer.id].notifyChannel != "general") {
      bot.sendMessage(ServerSettings[objServer.id].notifyChannel, ":warning: " + objUser.username.replace(/@/g, "@\u200b") + " was banned");
    } else {
      bot.sendMessage(objServer.defaultChannel, ":banana::hammer: " + objUser.username.replace(/@/g, "@\u200b") + " was banned");
    }
    bot.sendMessage(objUser, ":banana::hammer: You were banned from " + objServer.name);
  }
});
bot.on("userUnbanned", (objUser, objServer) => {
  if (objServer.members.length <= 500 && config.non_essential_event_listeners) {
    console.log(objUser.username + " unbanned on " + objServer.name);
  }
});
bot.on("serverDeleted", (objServer) => {
  console.log(cUYellow("Left server") + " " + objServer.name);
  db.handleLeave(objServer);
});
bot.on("serverCreated", (server) => {
  if (db.serverIsNew(server)) {
    console.log(cGreen("Joined server: ") + server.name);
    if (config.banned_server_ids && config.banned_server_ids.indexOf(server.id) > -1) {
      console.log(cRed("Joined server but it was on the ban list") + ": " + server.name);
      bot.sendMessage(server.defaultChannel, "This server is on the ban list");
      setTimeout(() => {
        bot.leaveServer(server);
      }, 1000);
    } else {
      var toSend = [];
      toSend.push(":wave: Hi! I'm **" + bot.user.username.replace(/@/g, "@\u200b") + "**");
      toSend.push("You can use **`" + config.command_prefix + "help`** to see what I can do.");
      toSend.push("Mod/Admin commands *including bot settings* can be viewed with **`" + config.mod_command_prefix + "help`**");
      toSend.push("For help, feedback. bugs, info, changelogs, etc. go to Link will be here soon <3");
      bot.sendMessage(server.defaultChannel, toSend);
      db.addServer(server);
      db.addServerToTimes(server);
    }
  }
});
console.log("Logging in...");
bot.loginWithToken(process.env.TOKEN, (err, token) => {
  if (err) {
    console.log(err);
    setTimeout(() => {
      process.exit(1);
    }, 2000);
  }
  if (!token) {
    console.log(cWarn(" WARN ") + " failed to connect");
    setTimeout(() => {
      process.exit(0);
    }, 2000);
  }
});

function evaluateString(msg) {
  if (msg.author.id != process.env.ADMIN_ID) {
    console.log(cWarn(" WARN ") + " Somehow an unauthorized user got into eval!");
    return;
  }
  var timeTaken = new Date();
  var result;
  console.log("Running eval");
  try {
    result = eval(msg.content.substring(7).replace(/\n/g, ""));
  } catch (e) {
    console.log(cError(" ERROR ") + " " + e);
    var toSend = [];
    toSend.push(":x: Error evaluating");
    toSend.push("```diff");
    toSend.push("- " + e);
    toSend.push("```");
    bot.sendMessage(msg, toSend);
  }
  if (result) {
    var toSend = [];
    toSend.push(":white_check_mark: Evaluated successfully:");
    toSend.push("```");
    toSend.push(result);
    toSend.push("```");
    toSend.push("Time taken: " + (timeTaken - msg.timestamp) + " ms");
    bot.sendMessage(msg, toSend);
    console.log("Result: " + result);
  }
}
function reload() {
  delete require.cache[require.resolve(__dirname + "/bot/config.json")];
  delete require.cache[require.resolve(__dirname + "/bot/commands.js")];
  delete require.cache[require.resolve(__dirname + "/bot/mod.js")];
  delete require.cache[require.resolve(__dirname + "/bot/versioncheck.js")];
  delete require.cache[require.resolve(__dirname + "/bot/db.js")];
  config = require(__dirname + "/bot/config.json");
  versionCheck = require(__dirname + "/bot/versioncheck.js");
  db = require(__dirname + "/bot/db.js");
  try {
    commands = require(__dirname + "/bot/commands.js");
  } catch (err) {
    console.log(cError(" ERROR ") + " Problem loading commands.js: " + err);
  }
  try {
    mod = require(__dirname + "/bot/mod.js");
  } catch (err) {
    console.log(cError(" ERROR ") + " Problem loading mod.js: " + err);
  }
  console.log(cBgGreen(" Module Reload ") + " Success");
}

function checkConfig() {
  if (!config.command_prefix || config.command_prefix.length !== 1) {
    console.log(cWarn(" WARN ") + "Prefix either not defined or more than one character");
  }
  if (!config.mod_command_prefix || config.mod_command_prefix.length !== 1) {
    console.log(cWarn(" WARN ") + "Mod prefix either not defined or more than character");
  }
}

function checkDb() {
  try {
    fs.statSync("./db/");
  } catch (e) {
    console.log(cBgGreen(" SETUP ") + " 'db' folder doesn't exist, creating it...");
    fs.mkdirSync("./db/");
  }
  try {
    fs.statSync("./db/servers.json");
  } catch (e) {
    console.log(cBgGreen(" SETUP ") + " 'db/servers.json' doesn't exist, creating it...");
    fs.writeFileSync("./db/servers.json", "{}");
  }
  try {
    fs.statSync("./db/times.json");
  } catch (e) {
    console.log(cBgGreen(" SETUP ") + " 'db/times.json' doesn't exist, creating it...");
    fs.writeFileSync("./db/times.json", "{}");
  }
}
// Run this every hour
if (process.env.CARBON_KEY) {
  setInterval(() => {
    request.post({
      "url": "https://www.carbonitex.net/discord/data/botdata.php",
      "headers": {
        "content-type": "application/json"
      },
      "json": true,
      body: {
        "key": process.env.CARBON_KEY,
        "servercount": bot.servers.length
      }
    }, (err, res) => {
      if (err) {
        console.log(cError(" ERROR ") + " Error updating carbon stats: " + err);
      }
      if (res.statusCode !== 200) {
        console.log(cError(" ERROR ") + " Error updating carbon stats: Status Code " + res.statusCode);
      }
      console.log(cBgGreen(" CARBON ") + " Updated Carbon server count to " + bot.servers.length);
    });
  }, 3600000);
}



