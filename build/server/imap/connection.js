// Generated by CoffeeScript 1.9.1
var ImapConnection, ImapImpossible, MailParser, NodeImapConnection, _, _old1, async, errors, isFolderDuplicate, isFolderForbidden, isFolderUndeletable, log, mailutils, stream_to_buffer_array,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  slice = [].slice;

NodeImapConnection = require('imap');

MailParser = require('mailparser').MailParser;

stream_to_buffer_array = require('../utils/stream_to_array');

async = require('async');

log = require('../utils/logging')({
  prefix: 'imap:extensions'
});

mailutils = require('../utils/jwz_tools');

errors = require('../utils/errors');

ImapImpossible = errors.ImapImpossible, isFolderForbidden = errors.isFolderForbidden;

isFolderDuplicate = errors.isFolderDuplicate, isFolderUndeletable = errors.isFolderUndeletable;

_ = require('lodash');

_old1 = MailParser.prototype._parseHeaderLineWithParams;

MailParser.prototype._parseHeaderLineWithParams = function(value) {
  return _old1.call(this, value.replace('" format=flowed', '"; format=flowed'));
};

module.exports = ImapConnection = (function(superClass) {
  extend(ImapConnection, superClass);

  function ImapConnection() {
    return ImapConnection.__super__.constructor.apply(this, arguments);
  }

  ImapConnection.prototype.getBoxesArray = function(callback) {
    log.debug("getBoxesArray");
    return this.getBoxes(function(err, boxes) {
      if (err) {
        return callback(err);
      }
      return callback(null, mailutils.flattenMailboxTree(boxes));
    });
  };

  ImapConnection.prototype.addBox2 = function(name, callback) {
    return this.addBox(name, function(err) {
      if (err && isFolderForbidden(err)) {
        return callback(new ImapImpossible('folder forbidden', err));
      } else if (err && isFolderDuplicate(err)) {
        return callback(new ImapImpossible('folder duplicate', err));
      } else {
        return callback(err);
      }
    });
  };

  ImapConnection.prototype.renameBox2 = function(oldname, newname, callback) {
    return this.renameBox(oldname, newname, function(err) {
      if (err && isFolderForbidden(err)) {
        return callback(new ImapImpossible('folder forbidden', err));
      } else if (err && isFolderDuplicate(err)) {
        return callback(new ImapImpossible('folder duplicate', err));
      } else {
        return callback(err);
      }
    });
  };

  ImapConnection.prototype.delBox2 = function(name, callback) {
    return this.delBox(name, function(err) {
      if (err && isFolderUndeletable(err)) {
        return callback(new ImapImpossible('folder undeletable', err));
      } else {
        return callback(err);
      }
    });
  };

  ImapConnection.prototype.fetchBoxMessageIDs = function(callback) {
    var results;
    log.debug("imap#fetchBoxMessageIDs");
    results = {};
    return this.search([['ALL']], (function(_this) {
      return function(err, uids) {
        var fetch;
        log.debug("imap#fetchBoxMessageIDs#result", uids.length);
        if (err) {
          return callback(err);
        }
        if (uids.length === 0) {
          return callback(null, []);
        }
        fetch = _this.fetch(uids, {
          bodies: 'HEADER.FIELDS (MESSAGE-ID)'
        });
        fetch.on('error', function(err) {
          return callback(err);
        });
        fetch.on('message', function(msg) {
          var messageID, uid;
          uid = null;
          messageID = null;
          msg.on('error', function(err) {
            return results.error = err;
          });
          msg.on('attributes', function(attrs) {
            return uid = attrs.uid;
          });
          msg.on('end', function() {
            return results[uid] = messageID;
          });
          return msg.on('body', function(stream) {
            return stream_to_buffer_array(stream, function(err, parts) {
              var buffer, header;
              if (err) {
                return log.error("fetchBoxMessageIDs fail", err);
              }
              buffer = Buffer.concat(parts);
              header = buffer.toString('utf8').trim();
              return messageID = header.substring(header.indexOf(':'));
            });
          });
        });
        return fetch.on('end', function() {
          return callback(null, results);
        });
      };
    })(this));
  };

  ImapConnection.prototype.fetchBoxMessageUIDs = function(callback) {
    log.debug("imap#fetchBoxMessageUIDs");
    return this.search([['ALL']], function(err, uids) {
      log.debug("imap#fetchBoxMessageUIDs#result", uids.length);
      if (err) {
        return callback(err);
      }
      return callback(null, uids);
    });
  };

  ImapConnection.prototype.fetchMetadataSince = function(modseqno, callback) {
    log.debug("imap#fetchBoxMessageSince", modseqno);
    return this.search([['MODSEQ', modseqno]], function(err, uids) {
      var fetch, results;
      log.debug("imap#fetchBoxMessageSince#result", uids);
      if (err) {
        return callback(err);
      }
      if (!uids.length) {
        return callback(null, {});
      }
      uids.sort().reverse();
      results = {};
      fetch = this.fetch(uids, {
        bodies: 'HEADER.FIELDS (MESSAGE-ID)'
      });
      fetch.on('error', callback);
      fetch.on('message', function(msg) {
        var flags, mid, uid;
        uid = null;
        flags = null;
        mid = null;
        msg.on('error', function(err) {
          return results.error = err;
        });
        msg.on('end', function() {
          return results[uid] = [mid, flags];
        });
        msg.on('attributes', function(attrs) {
          return flags = attrs.flags, uid = attrs.uid, attrs;
        });
        return msg.on('body', function(stream) {
          return stream_to_buffer_array(stream, function(err, parts) {
            var header;
            if (err) {
              return callback(err);
            }
            header = Buffer.concat(parts).toString('utf8').trim();
            return mid = header.substring(header.indexOf(':') + 1);
          });
        });
      });
      return fetch.on('end', function() {
        return callback(null, results);
      });
    });
  };

  ImapConnection.prototype.fetchMetadata = function(min, max, callback) {
    log.debug("imap#fetchMetadata", min, max);
    return this.search([['UID', min + ":" + max]], function(err, uids) {
      var fetch, results;
      log.debug("imap#fetchMetadata#results", err, uids != null ? uids.length : void 0);
      if (err) {
        return callback(err);
      }
      if (!uids.length) {
        return callback(null, {});
      }
      uids.sort().reverse();
      results = {};
      fetch = this.fetch(uids, {
        bodies: 'HEADER.FIELDS (MESSAGE-ID)'
      });
      fetch.on('error', callback);
      fetch.on('message', function(msg) {
        var flags, mid, uid;
        uid = null;
        flags = null;
        mid = null;
        msg.on('error', function(err) {
          return results.error = err;
        });
        msg.on('end', function() {
          return results[uid] = [mid, flags];
        });
        msg.on('attributes', function(attrs) {
          return flags = attrs.flags, uid = attrs.uid, attrs;
        });
        return msg.on('body', function(stream) {
          return stream_to_buffer_array(stream, function(err, parts) {
            var header;
            if (err) {
              return callback(err);
            }
            header = Buffer.concat(parts).toString('utf8').trim();
            return mid = header.substring(header.indexOf(':') + 1);
          });
        });
      });
      return fetch.on('end', function() {
        return callback(null, results);
      });
    });
  };

  ImapConnection.prototype.fetchOneMail = function(uid, callback) {
    var fetch, messageReceived;
    messageReceived = false;
    fetch = this.fetch([uid], {
      size: true,
      bodies: ''
    });
    fetch.on('message', function(msg) {
      var flags;
      flags = [];
      messageReceived = true;
      msg.once('error', callback);
      msg.on('attributes', function(attrs) {
        return flags = attrs.flags;
      });
      return msg.on('body', function(stream) {
        return stream_to_buffer_array(stream, function(err, buffers) {
          var i, len, mailparser, part;
          if (err) {
            return callback(err);
          }
          mailparser = new MailParser();
          mailparser.on('error', callback);
          mailparser.on('end', function(mail) {
            mail.flags = flags;
            return callback(null, mail);
          });
          for (i = 0, len = buffers.length; i < len; i++) {
            part = buffers[i];
            mailparser.write(part);
          }
          return mailparser.end();
        });
      });
    });
    fetch.on('error', callback);
    return fetch.on('end', function() {
      if (!messageReceived) {
        return callback(new Error('fetch ended with no message'));
      }
    });
  };

  ImapConnection.prototype.fetchOneMailRaw = function(uid, callback) {
    var fetch, messageReceived;
    messageReceived = false;
    fetch = this.fetch([uid], {
      size: true,
      bodies: ''
    });
    fetch.on('message', function(msg) {
      var flags;
      flags = [];
      messageReceived = true;
      msg.once('error', callback);
      msg.on('attributes', function(attrs) {
        return flags = attrs.flags;
      });
      return msg.on('body', function(stream, info) {
        return stream_to_buffer_array(stream, function(err, parts) {
          if (err) {
            return callback(err);
          }
          return callback(null, Buffer.concat(parts));
        });
      });
    });
    fetch.on('error', callback);
    return fetch.on('end', function() {
      if (!messageReceived) {
        return callback(new Error('fetch ended with no message'));
      }
    });
  };

  ImapConnection.prototype.multicopy = function(uid, paths, callback) {
    return async.mapSeries(paths, (function(_this) {
      return function(path, cb) {
        return _this.copy(uid, path, cb);
      };
    })(this), callback);
  };

  ImapConnection.prototype.multiremove = function(paths, callback) {
    return async.eachSeries(paths, (function(_this) {
      return function(arg, cb) {
        var path, uid;
        path = arg.path, uid = arg.uid;
        if (uid == null) {
          return cb(new Error('no message to remove'));
        }
        return _this.deleteMessageInBox(path, uid, cb);
      };
    })(this), callback);
  };

  ImapConnection.prototype.deleteAndExpunge = function(uid, callback) {
    return this.addFlags(uid, '\\Deleted', function(err) {
      if (err) {
        return callback(err);
      }
      return this.expunge(uid, callback);
    });
  };

  ImapConnection.prototype.multimove = function(uids, dests, callback) {
    var first, rest;
    if (uids.length === 0) {
      return callback(null);
    } else {
      first = dests[0], rest = 2 <= dests.length ? slice.call(dests, 1) : [];
      return this.multicopy(uids, rest, (function(_this) {
        return function(err) {
          if (err) {
            return callback(err);
          }
          return _this.move(uids, first, callback);
        };
      })(this));
    }
  };

  ImapConnection.prototype.multiexpunge = function(uids, callback) {
    if (uids.length === 0) {
      return callback(null);
    } else {
      return this.deleteAndExpunge(uids, callback);
    }
  };

  ImapConnection.prototype.deleteMessageInBox = function(path, uid, callback) {
    return async.series([
      (function(_this) {
        return function(cb) {
          return _this.openBox(path, cb);
        };
      })(this), (function(_this) {
        return function(cb) {
          return _this.addFlags(uid, '\\Deleted', cb);
        };
      })(this), (function(_this) {
        return function(cb) {
          return _this.expunge(uid, cb);
        };
      })(this)
    ], callback);
  };

  return ImapConnection;

})(NodeImapConnection);

module.exports = ImapConnection;
