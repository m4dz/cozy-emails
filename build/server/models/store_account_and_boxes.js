// Generated by CoffeeScript 1.10.0
var Account, EventEmitter, ImapPool, Mailbox, Message, Scheduler, _, accountsByID, allAccounts, async, countsByMailboxID, eventEmitter, imapPools, log, mailboxesByAccountID, mailboxesByID, onMessageCreated, onMessageDestroyed, orphanMailboxes, retrieveAccounts, retrieveCounts, retrieveMailboxes, retrieveTotalCounts, unreadByAccountID,
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

Account = require('./account');

Message = require('./message');

Mailbox = require('./mailbox');

Scheduler = require('../processes/_scheduler');

ImapPool = require('../imap/pool');

_ = require('lodash');

async = require('async');

log = require('../utils/logging')({
  prefix: 'models:ramStore'
});

EventEmitter = require('events').EventEmitter;

accountsByID = {};

allAccounts = [];

mailboxesByID = {};

mailboxesByAccountID = {};

orphanMailboxes = [];

countsByMailboxID = {};

unreadByAccountID = {};

imapPools = {};

eventEmitter = new EventEmitter();

retrieveAccounts = function(callback) {
  log.debug("retrieveAccounts");
  return Account.all(function(err, cozyAccounts) {
    if (err) {
      return callback(err);
    }
    return async.mapSeries(cozyAccounts, function(account, next) {
      return Account.find(account.id, next);
    }, function(err, cozyAccounts) {
      var account, i, len;
      if (err) {
        return callback(err);
      }
      for (i = 0, len = cozyAccounts.length; i < len; i++) {
        account = cozyAccounts[i];
        exports.addAccount(account);
      }
      return callback(null);
    });
  });
};

retrieveMailboxes = function(callback) {
  log.debug("retrieveMailboxes");
  return Mailbox.rawRequest('treeMap', {
    include_docs: true
  }, function(err, rows) {
    var box, i, len, row;
    if (err) {
      return callback(err);
    }
    for (i = 0, len = rows.length; i < len; i++) {
      row = rows[i];
      box = new Mailbox(row.doc);
      exports.addMailbox(box);
    }
    return callback(null);
  });
};

retrieveCounts = function(callback) {
  var options;
  log.debug("retrieveCounts");
  options = {
    startkey: ['date', ""],
    endkey: ['date', {}],
    reduce: true,
    group_level: 3
  };
  return Message.rawRequest('byMailboxRequest', options, function(err, rows) {
    var DATEFLAG, boxID, flag, i, len, ref, row;
    if (err) {
      return callback(err);
    }
    for (i = 0, len = rows.length; i < len; i++) {
      row = rows[i];
      ref = row.key, DATEFLAG = ref[0], boxID = ref[1], flag = ref[2];
      if (countsByMailboxID[boxID] == null) {
        countsByMailboxID[boxID] = {
          unread: 0,
          total: 0,
          recent: 0
        };
      }
      if (flag === "!\\Recent") {
        countsByMailboxID[boxID].recent = row.recent;
      }
      if (flag === "!\\Seen") {
        countsByMailboxID[boxID].unread = row.value;
      } else if (flag === null) {
        countsByMailboxID[boxID].total = row.value;
      }
    }
    return callback(null);
  });
};

retrieveTotalCounts = function(callback) {
  log.debug("retrieveTotalCounts");
  return Message.rawRequest('totalUnreadByAccount', {
    reduce: true
  }, function(err, rows) {
    var accountID, count, i, len, row;
    if (err) {
      return callback(err);
    }
    for (i = 0, len = rows.length; i < len; i++) {
      row = rows[i];
      accountID = row.key;
      count = row.value;
      unreadByAccountID[accountID] = count;
    }
    return callback(null);
  });
};

exports.initialize = function(callback) {
  return async.series([retrieveAccounts, retrieveMailboxes, retrieveCounts, retrieveTotalCounts], callback);
};

exports.clientList = function() {
  var id;
  return (function() {
    var results;
    results = [];
    for (id in accountsByID) {
      results.push(exports.getAccountClientObject(id));
    }
    return results;
  })();
};

exports.getAccountClientObject = function(id) {
  var rawObject, ref;
  rawObject = (ref = accountsByID[id]) != null ? ref.toObject() : void 0;
  if (!rawObject) {
    return null;
  }
  if (rawObject.favorites == null) {
    rawObject.favorites = [];
  }
  rawObject.totalUnread = unreadByAccountID[id] || 0;
  rawObject.mailboxes = mailboxesByAccountID[id].map(function(box) {
    return exports.getMailboxClientObject(box.id);
  });
  return rawObject;
};

exports.getMailboxClientObject = function(id) {
  var box, clientBox, count;
  count = countsByMailboxID[id];
  box = mailboxesByID[id];
  return clientBox = {
    id: box.id,
    label: box.label,
    tree: box.tree,
    attribs: box.attribs,
    nbTotal: (count != null ? count.total : void 0) || 0,
    nbUnread: (count != null ? count.unread : void 0) || 0,
    nbRecent: (count != null ? count.recent : void 0) || 0,
    lastSync: box.lastSync
  };
};

exports.on = eventEmitter.on.bind(eventEmitter);

exports.getAllAccounts = function() {
  var account, id;
  return (function() {
    var results;
    results = [];
    for (id in accountsByID) {
      account = accountsByID[id];
      results.push(account);
    }
    return results;
  })();
};

exports.getAccount = function(accountID) {
  return accountsByID[accountID];
};

exports.getAllMailboxes = function() {
  var account, i, id, len, mailbox, out, ref;
  out = [];
  for (id in accountsByID) {
    account = accountsByID[id];
    ref = exports.getMailboxesByAccount(id);
    for (i = 0, len = ref.length; i < len; i++) {
      mailbox = ref[i];
      out.push(mailbox);
    }
  }
  return out;
};

exports.getFavoriteMailboxes = function() {
  var account, i, id, len, mailbox, out, ref, ref1;
  out = [];
  for (id in accountsByID) {
    account = accountsByID[id];
    ref = exports.getMailboxesByAccount(id);
    for (i = 0, len = ref.length; i < len; i++) {
      mailbox = ref[i];
      if ((ref1 = mailbox.id, indexOf.call(account.favorites, ref1) >= 0) || []) {
        out.push(mailbox);
      }
    }
  }
  return out;
};

exports.getFavoriteMailboxesByAccount = function(accountID) {
  var account, i, len, mailbox, out, ref, ref1;
  out = [];
  account = exports.getAccount(accountID);
  ref = exports.getMailboxesByAccount(accountID);
  for (i = 0, len = ref.length; i < len; i++) {
    mailbox = ref[i];
    if ((ref1 = mailbox.id, indexOf.call(account.favorites, ref1) >= 0) || []) {
      out.push(mailbox);
    }
  }
  return out.sort(function(a, b) {
    if (a.label === 'INBOX') {
      return -1;
    } else if (b.label === 'INBOX') {
      return 1;
    } else {
      return a.label.localeCompare(b.label);
    }
  });
};

exports.getMailbox = function(mailboxID) {
  return mailboxesByID[mailboxID];
};

exports.getMailboxesIDByAccount = function(accountID) {
  return exports.getMailboxesByAccount(accountID).map(function(box) {
    return box.id;
  });
};

exports.getMailboxesByAccount = function(accountID) {
  return mailboxesByAccountID[accountID] || [];
};

exports.getSelfAndChildrenOf = function(mailbox) {
  return exports.getMailboxesByAccount(mailbox.accountID).filter(function(box) {
    return box.path.indexOf(mailbox.path) === 0;
  });
};

exports.getOrphanBoxes = function() {
  return orphanMailboxes;
};

exports.getMailboxesID = function(mailboxID) {
  return Object.keys(mailboxesByID);
};

exports.getUninitializedAccount = function() {
  return exports.getAllAccounts().filter(function(account) {
    return account.initialized === false;
  });
};

exports.getIgnoredMailboxes = function(accountID) {
  var box, i, ignores, len, ref;
  ignores = {};
  ref = exports.getMailboxesByAccount(accountID);
  for (i = 0, len = ref.length; i < len; i++) {
    box = ref[i];
    ignores[box.id] = box.ignoreInCount();
  }
  return ignores;
};

exports.getImapPool = function(object) {
  if (object.accountID) {
    return imapPools[object.accountID];
  } else {
    return imapPools[object.id];
  }
};

exports.addAccount = function(account) {
  log.debug("addAccount");
  accountsByID[account.id] = account;
  allAccounts.push(account);
  imapPools[account.id] = new ImapPool(account);
  return mailboxesByAccountID[account.id] = [];
};

exports.removeAccount = function(accountID) {
  var box, i, len, mailboxes;
  log.debug("removeAccount");
  allAccounts = allAccounts.filter(function(tested) {
    return tested.id !== accountID;
  });
  delete accountsByID[accountID];
  delete unreadByAccountID[accountID];
  mailboxes = mailboxesByAccountID[accountID];
  delete mailboxesByAccountID[accountID];
  for (i = 0, len = mailboxes.length; i < len; i++) {
    box = mailboxes[i];
    orphanMailboxes.push(box);
  }
  return Scheduler.orphanRemovalDebounced(accountID);
};

exports.addMailbox = function(mailbox) {
  var accountID, name;
  mailboxesByID[mailbox.id] = mailbox;
  accountID = mailbox.accountID;
  if (countsByMailboxID[name = mailbox.id] == null) {
    countsByMailboxID[name] = {
      unread: 0,
      total: 0,
      recent: 0
    };
  }
  if (mailboxesByAccountID[accountID]) {
    return mailboxesByAccountID[accountID].push(mailbox);
  } else {
    return orphanMailboxes.push(mailbox);
  }
};

exports.removeMailbox = function(mailboxID) {
  var accountID, list, mailbox;
  log.debug("removeMailbox");
  mailbox = mailboxesByID[mailboxID];
  delete mailboxesByID[mailboxID];
  accountID = mailbox.accountID;
  list = mailboxesByAccountID[accountID];
  if (list) {
    mailboxesByAccountID[accountID] = _.without(list, mailbox);
  }
  list = orphanMailboxes;
  orphanMailboxes = _.without(list, mailbox);
  return Scheduler.orphanRemovalDebounced();
};

Account.on('create', function(created) {
  return exports.addAccount(created);
});

Account.on('delete', function(id, deleted) {
  return exports.removeAccount(id);
});

Mailbox.on('create', function(created) {
  return exports.addMailbox(created);
});

Mailbox.on('delete', function(id, deleted) {
  return exports.removeMailbox(id);
});

Message.on('create', onMessageCreated = function(created) {
  var boxID, isRead, isRecent, ref, uid;
  isRead = indexOf.call(created.flags, '\\Seen') >= 0;
  isRecent = indexOf.call(created.flags, '\\Recent') >= 0;
  ref = created.mailboxIDs;
  for (boxID in ref) {
    uid = ref[boxID];
    countsByMailboxID[boxID].total += 1;
    if (!isRead) {
      countsByMailboxID[boxID].unread += 1;
    }
    if (isRecent) {
      countsByMailboxID[boxID].recent += 1;
    }
  }
  if (isRead) {
    unreadByAccountID[created.accountID] += 1;
  }
  return eventEmitter.emit('change', created.accountID);
});

Message.on('delete', onMessageDestroyed = function(id, old) {
  var boxID, ref, uid, wasRead, wasRecent;
  wasRead = indexOf.call(old.flags, '\\Seen') >= 0;
  wasRecent = indexOf.call(old.flags, '\\Recent') >= 0;
  ref = old.mailboxIDs;
  for (boxID in ref) {
    uid = ref[boxID];
    countsByMailboxID[boxID].total -= 1;
    if (!wasRead) {
      countsByMailboxID[boxID].unread -= 1;
    }
    if (wasRecent) {
      countsByMailboxID[boxID].recent -= 1;
    }
  }
  if (wasRead) {
    unreadByAccountID[old.accountID] -= 1;
  }
  return eventEmitter.emit('change', old.accountID);
});

Message.on('update', function(updated, old) {
  onMessageDestroyed(old.id, old);
  return onMessageCreated(updated);
});
