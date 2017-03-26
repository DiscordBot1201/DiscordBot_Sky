/**
 * Required Dependencies
 */
var request = require("request");
var version = require("../package.json").version;
exports.checkForUpdate = function() {
  request("https://raw.githubusercontent.com/unlucky4ever/RuneCord/master/package.json", (err, response, body) => {
    if (err) {
      console.log(cWarn = " WARN " + " Version check error: " + err);
    } else if (response.statusCode == 200) {
      var latest = JSON.parse(body).version;
      if ((version.split(".").join("")) < (latest.split(".").join(""))) {
        console.log("Bot is out of date! (current v" + version + ") (latest v" + latest + ")");
      } else {
        console.log("SkyCode is up-to-date (v" + version + ")");
      }
    } else {
      console.log(cWarn(" WARN ") + " Failed to check for new version. Status code: " + response.statusCode);
    }
  });
};
