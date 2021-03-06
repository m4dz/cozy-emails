// Generated by CoffeeScript 1.9.0
var Imap, ImapImpossible, MailParser, async, folderDuplicate, folderForbidden, folderUndeletable, log, mailutils, stream_to_buffer_array, _, _old1;

Imap = require('imap');

MailParser = require('mailparser').MailParser;

stream_to_buffer_array = require('../utils/stream_to_array');

async = require('async');

log = require('../utils/logging')({
  prefix: 'imap:extensions'
});

mailutils = require('../utils/jwz_tools');

ImapImpossible = require('../utils/errors').ImapImpossible;

_ = require('lodash');

folderForbidden = function(err) {
  return /Folder name (.*) is not allowed./.test(err.message);
};

folderDuplicate = function(err) {
  return /Duplicate folder name/.test(err.message);
};

folderUndeletable = function(err) {
  return /Internal folder cannot be deleted/.test(err.message);
};

_old1 = MailParser.prototype._parseHeaderLineWithParams;

MailParser.prototype._parseHeaderLineWithParams = function(value) {
  return _old1.call(this, value.replace('" format=flowed', '"; format=flowed'));
};

Imap.prototype.getBoxesArray = function(callback) {
  log.debug("getBoxesArray");
  return this.getBoxes(function(err, boxes) {
    if (err) {
      return callback(err);
    }
    return callback(null, mailutils.flattenMailboxTree(boxes));
  });
};

Imap.prototype.openBoxCheap = function(name, callback) {
  var _ref;
  if (((_ref = this._box) != null ? _ref.name : void 0) === name) {
    callback(null, this._box);
  }
  return this.openBox.apply(this, arguments);
};

Imap.prototype.addBox2 = function(name, callback) {
  return this.addBox(name, function(err) {
    if (err && folderForbidden(err)) {
      callback(new ImapImpossible('folder forbidden', err));
    }
    if (err && folderDuplicate(err)) {
      callback(new ImapImpossible('folder duplicate', err));
    }
    return callback(err);
  });
};

Imap.prototype.renameBox2 = function(oldname, newname, callback) {
  return this.renameBox(oldname, newname, function(err) {
    if (err && folderForbidden(err)) {
      callback(new ImapImpossible('folder forbidden', err));
    }
    if (err && folderDuplicate(err)) {
      callback(new ImapImpossible('folder duplicate', err));
    }
    return callback(err);
  });
};

Imap.prototype.delBox2 = function(name, callback) {
  return this.delBox(name, function(err) {
    if (err && folderUndeletable(err)) {
      callback(new ImapImpossible('folder undeletable', err));
    }
    return callback(err);
  });
};

Imap.prototype.fetchBoxMessageIDs = function(callback) {
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
              return log.error(err);
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

Imap.prototype.fetchBoxMessageUIDs = function(callback) {
  log.debug("imap#fetchBoxMessageUIDs");
  return this.search([['ALL']], function(err, uids) {
    log.debug("imap#fetchBoxMessageUIDs#result", uids);
    if (err) {
      return callback(err);
    }
    return callback(null, uids);
  });
};

Imap.prototype.fetchMetadata = function(min, max, callback) {
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

Imap.prototype.fetchOneMail = function(uid, callback) {
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
        var mailparser, part, _i, _len;
        if (err) {
          return callback(err);
        }
        mailparser = new MailParser();
        mailparser.on('error', callback);
        mailparser.on('end', function(mail) {
          mail.flags = flags;
          return callback(null, mail);
        });
        for (_i = 0, _len = buffers.length; _i < _len; _i++) {
          part = buffers[_i];
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

Imap.prototype.fetchOneMailRaw = function(uid, callback) {
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

Imap.prototype.multicopy = function(uid, paths, callback) {
  return async.mapSeries(paths, (function(_this) {
    return function(path, cb) {
      return _this.copy(uid, path, cb);
    };
  })(this), callback);
};

Imap.prototype.multiremove = function(paths, callback) {
  return async.eachSeries(paths, (function(_this) {
    return function(_arg, cb) {
      var path, uid;
      path = _arg.path, uid = _arg.uid;
      return _this.deleteMessageInBox(path, uid, cb);
    };
  })(this), callback);
};

Imap.prototype.deleteMessageInBox = function(path, uid, callback) {
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

module.exports = Imap;
