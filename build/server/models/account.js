// Generated by CoffeeScript 1.10.0
var Account, AccountConfigError, CONSTANTS, Compiler, ImapPool, Mailbox, MailboxRefreshList, Message, NotFound, RefreshError, RemoveMessageByAccount, SMTPConnection, Scheduler, TestAccount, _, async, cozydb, log, makeSMTPConfig, nodemailer, notifications, ramStore, ref, refreshTimeout,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

cozydb = require('cozydb');

Account = (function(superClass) {
  extend(Account, superClass);

  Account.docType = 'Account';

  Account.schema = {
    label: String,
    name: String,
    login: String,
    password: String,
    accountType: String,
    oauthProvider: String,
    oauthAccessToken: String,
    oauthRefreshToken: String,
    oauthTimeout: Number,
    initialized: Boolean,
    smtpServer: String,
    smtpPort: Number,
    smtpSSL: Boolean,
    smtpTLS: Boolean,
    smtpLogin: String,
    smtpPassword: String,
    smtpMethod: String,
    imapLogin: String,
    imapServer: String,
    imapPort: Number,
    imapSSL: Boolean,
    imapTLS: Boolean,
    inboxMailbox: String,
    flaggedMailbox: String,
    draftMailbox: String,
    sentMailbox: String,
    trashMailbox: String,
    junkMailbox: String,
    allMailbox: String,
    favorites: [String],
    patchIgnored: Boolean,
    supportRFC4551: Boolean,
    signature: String
  };

  function Account(attributes) {
    if (attributes.accountType === 'TEST') {
      return new TestAccount(attributes);
    } else {
      Account.__super__.constructor.apply(this, arguments);
    }
  }

  Account.prototype.initialize = function(callback) {
    var refreshList;
    refreshList = new MailboxRefreshList({
      account: this
    });
    return Scheduler.schedule(refreshList, Scheduler.ASAP, (function(_this) {
      return function(err) {
        var boxes, changes;
        if (err) {
          return callback(err);
        }
        boxes = ramStore.getMailboxesByAccount(_this.id);
        changes = Mailbox.scanBoxesForSpecialUse(boxes);
        changes.initialized = true;
        return _this.updateAttributes(changes, callback);
      };
    })(this));
  };

  Account.prototype.isTest = function() {
    return false;
  };

  Account.prototype.testConnections = function(callback) {
    return this.testSMTPConnection((function(_this) {
      return function(err) {
        var pool;
        if (err) {
          return callback(err);
        }
        pool = new ImapPool(_this);
        return pool.doASAP(function(imap, cbRelease) {
          return cbRelease(null, 'OK');
        }, function(err) {
          pool.destroy();
          if (err) {
            return callback(err);
          }
          return callback(null);
        });
      };
    })(this));
  };

  Account.prototype.forgetBox = function(boxid, callback) {
    var attribute, changes, i, len, ref;
    changes = {};
    ref = Object.keys(Mailbox.RFC6154);
    for (i = 0, len = ref.length; i < len; i++) {
      attribute = ref[i];
      if (this[attribute] === boxid) {
        changes[attribute] = null;
      }
    }
    if (indexOf.call(this.favorites, boxid) >= 0) {
      changes.favorites = _.without(this.favorites, boxid);
    }
    if (Object.keys(changes).length) {
      return this.updateAttributes(changes, callback);
    } else {
      return callback(null);
    }
  };

  Account.prototype.imap_getBoxes = function(callback) {
    var supportRFC4551;
    log.debug("getBoxes");
    supportRFC4551 = null;
    return ramStore.getImapPool(this).doASAP(function(imap, cb) {
      supportRFC4551 = imap.serverSupports('CONDSTORE');
      return imap.getBoxesArray(cb);
    }, (function(_this) {
      return function(err, boxes) {
        if (err) {
          return callback(err, []);
        }
        if (supportRFC4551 !== _this.supportRFC4551) {
          log.debug("UPDATING ACCOUNT " + _this.id + " rfc4551=" + _this.supportRFC4551);
          return _this.updateAttributes({
            supportRFC4551: supportRFC4551
          }, function(err) {
            if (err) {
              log.warn("fail to update account " + err.stack);
            }
            return callback(null, boxes || []);
          });
        } else {
          return callback(null, boxes || []);
        }
      };
    })(this));
  };

  Account.prototype.imap_createMail = function(box, message, callback) {
    var mailbuilder;
    mailbuilder = new Compiler(message).compile();
    return mailbuilder.build((function(_this) {
      return function(err, buffer) {
        if (err) {
          return callback(err);
        }
        return ramStore.getImapPool(_this).doASAP(function(imap, cb) {
          return imap.append(buffer, {
            mailbox: box.path,
            flags: message.flags
          }, cb);
        }, function(err, uid) {
          if (err) {
            return callback(err);
          }
          return callback(null, uid);
        });
      };
    })(this));
  };

  Account.prototype.sendMessage = function(message, callback) {
    var inReplyTo, options, transport;
    inReplyTo = message.inReplyTo;
    message.inReplyTo = inReplyTo != null ? inReplyTo.shift() : void 0;
    options = makeSMTPConfig(this);
    transport = nodemailer.createTransport(options);
    return transport.sendMail(message, function(err, info) {
      message.inReplyTo = inReplyTo;
      return callback(err, info);
    });
  };

  Account.prototype.testSMTPConnection = function(callback) {
    var connection, options, reject, timeout;
    reject = _.once(callback);
    options = makeSMTPConfig(this);
    connection = new SMTPConnection(options);
    connection.once('error', function(err) {
      log.warn("SMTP CONNECTION ERROR", err);
      return reject(new AccountConfigError('smtpServer', err));
    });
    timeout = setTimeout(function() {
      reject(new AccountConfigError('smtpPort'));
      return connection.close();
    }, 10000);
    return connection.connect((function(_this) {
      return function(err) {
        if (err) {
          return reject(new AccountConfigError('smtpServer', err));
        }
        clearTimeout(timeout);
        if (_this.smtpMethod !== 'NONE') {
          return connection.login(options.auth, function(err) {
            var field;
            if (err) {
              field = _this.smtpLogin ? 'smtpAuth' : 'auth';
              reject(new AccountConfigError(field, err));
            } else {
              callback(null);
            }
            return connection.close();
          });
        } else {
          callback(null);
          return connection.close();
        }
      };
    })(this));
  };

  return Account;

})(cozydb.CozyModel);

TestAccount = (function(superClass) {
  extend(TestAccount, superClass);

  function TestAccount(attributes) {
    if (attributes == null) {
      attributes = {};
    }
    Account.cast(attributes, this);
    if (attributes._id) {
      if (this.id == null) {
        this.id = attributes._id;
      }
    }
  }

  TestAccount.prototype.isTest = function() {
    return true;
  };

  TestAccount.prototype.testSMTPConnection = function(callback) {
    return callback(null);
  };

  TestAccount.prototype.sendMessage = function(message, callback) {
    return callback(null, {
      messageId: 66
    });
  };

  TestAccount.prototype.imap_getBoxes = function(callback) {
    return callback(null, ramStore.getMailboxesByAccount(this.id));
  };

  return TestAccount;

})(Account);

module.exports = Account;

require('./model-events').wrapModel(Account);

Mailbox = require('./mailbox');

Message = require('./message');

Compiler = require('nodemailer/src/compiler');

ImapPool = require('../imap/pool');

Scheduler = require('../processes/_scheduler');

ref = require('../utils/errors'), AccountConfigError = ref.AccountConfigError, RefreshError = ref.RefreshError;

NotFound = require('../utils/errors').NotFound;

makeSMTPConfig = require('../imap/account2config').makeSMTPConfig;

nodemailer = require('nodemailer');

SMTPConnection = require('nodemailer/node_modules/' + 'nodemailer-smtp-transport/node_modules/smtp-connection');

log = require('../utils/logging')({
  prefix: 'models:account'
});

_ = require('lodash');

async = require('async');

CONSTANTS = require('../utils/constants');

notifications = require('../utils/notifications');

MailboxRefreshList = require('../processes/mailbox_refresh_list');

ramStore = require('./store_account_and_boxes');

RemoveMessageByAccount = require('../processes/message_remove_by_account');

refreshTimeout = null;
