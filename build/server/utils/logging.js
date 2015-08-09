// Generated by CoffeeScript 1.9.1
var COLORS, LOG_LEVEL, MAX_INDEX, addToLastLogs, index, lastDate, lastLogs, pad, util;

util = require('util');

COLORS = ['\x1B[32mDBUG\x1B[39m', '\x1B[34mINFO\x1B[39m', '\x1B[33mWARN\x1B[39m', '\x1B[31mEROR\x1B[39m'];

LOG_LEVEL = process.env.DEBUG_LEVEL != null ? parseInt(process.env.DEBUG_LEVEL) : process.env.NODE_ENV === 'test' ? 3 : process.env.NODE_ENV === 'production' ? 1 : 0;

lastLogs = new Array(15);

lastDate = +new Date();

index = -1;

MAX_INDEX = 15;

addToLastLogs = function() {
  index = (index + 1) % MAX_INDEX;
  return lastLogs[index] = util.format.apply(this, arguments);
};

pad = function(nb) {
  return ((nb + 10000) + "").substring(1);
};

module.exports = function(options) {
  var api, logger, prefix;
  prefix = typeof options === 'string' ? options : options.prefix;
  logger = function(level) {
    return function() {
      var arg, args, delta, i, j, len, newDate;
      newDate = +new Date();
      delta = newDate - lastDate;
      lastDate = newDate;
      args = new Array(arguments.length + 3);
      args[0] = COLORS[level];
      args[1] = "+" + ((delta + 10000) + "").substring(1);
      args[2] = prefix;
      for (i = j = 0, len = arguments.length; j < len; i = ++j) {
        arg = arguments[i];
        args[i + 3] = arg;
      }
      addToLastLogs.apply(null, args);
      if (level < LOG_LEVEL) {
        return null;
      }
      return console.log.apply(console, args);
    };
  };
  return api = {
    debug: logger(0),
    info: logger(1),
    warn: logger(2),
    error: logger(3)
  };
};

module.exports.getLasts = function() {
  return lastLogs.slice(index + 1, +MAX_INDEX + 1 || 9e9).join("\n") + "\n" + lastLogs.slice(0, +index + 1 || 9e9).join("\n");
};
