// Generated by CoffeeScript 1.9.3
var AccountConfigError, BadRequest, Message, NotFound, Process, SaveOrSendMessage, async, isDSAttachment, log, normalizeMessageID, ramStore, ref, stream_to_buffer, uuid,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

Process = require('./_base');

async = require('async');

Message = require('../models/message');

stream_to_buffer = require('../utils/stream_to_array');

log = require('../utils/logging')({
  prefix: 'process:message_saving'
});

ref = require('../utils/errors'), NotFound = ref.NotFound, BadRequest = ref.BadRequest, AccountConfigError = ref.AccountConfigError;

normalizeMessageID = require('../utils/jwz_tools').normalizeMessageID;

uuid = require('uuid');

ramStore = require('../models/store_account_and_boxes');

isDSAttachment = function(attachment) {
  return attachment.url != null;
};

module.exports = SaveOrSendMessage = (function(superClass) {
  extend(SaveOrSendMessage, superClass);

  function SaveOrSendMessage() {
    this.removeOldBinaries = bind(this.removeOldBinaries, this);
    this.attachNewBinaries = bind(this.attachNewBinaries, this);
    this.createOrUdateCozy = bind(this.createOrUdateCozy, this);
    this.addToDraftOrSentImap = bind(this.addToDraftOrSentImap, this);
    this.removeOldDraftImap = bind(this.removeOldDraftImap, this);
    this.sendMessageSMTP = bind(this.sendMessageSMTP, this);
    this.gatherAttachments = bind(this.gatherAttachments, this);
    this._gatherOne = bind(this._gatherOne, this);
    this.fetchForwardedMessage = bind(this.fetchForwardedMessage, this);
    this.validateParameters = bind(this.validateParameters, this);
    this.initialize = bind(this.initialize, this);
    return SaveOrSendMessage.__super__.constructor.apply(this, arguments);
  }

  SaveOrSendMessage.prototype.code = 'message-save-or-send';

  SaveOrSendMessage.prototype.initialize = function(options, done) {
    var base, base1, err, ref1;
    this.message = options.message;
    this.oldVersion = options.previousState;
    this.account = options.account;
    this.draftMailbox = ramStore.getMailbox(this.account.draftMailbox);
    this.sentMailbox = ramStore.getMailbox(this.account.sentMailbox);
    this.isDraft = options.isDraft;
    this.newAttachments = options.newAttachments;
    this.previousUID = (ref1 = this.message.mailboxIDs) != null ? ref1[this.draftMailbox] : void 0;
    if ((base = this.message).conversationID == null) {
      base.conversationID = uuid.v4();
    }
    if ((base1 = this.message).attachments == null) {
      base1.attachments = [];
    }
    this.message.flags = ['\\Seen'];
    if (this.isDraft) {
      this.message.flags.push('\\Draft');
    }
    this.message.content = this.message.text;
    this.attachmentsClean = this.message.attachments;
    this.attachmentsWithBuffers = [];
    err = this.validateParameters();
    if (err) {
      return done(err);
    } else {
      return async.series([this.fetchForwardedMessage, this.gatherAttachments, this.sendMessageSMTP, this.removeOldDraftImap, this.addToDraftOrSentImap, this.createOrUdateCozy, this.attachNewBinaries, this.removeOldBinaries], done);
    }
  };

  SaveOrSendMessage.prototype.validateParameters = function() {
    if (this.isDraft || this.oldVersion) {
      if (!this.account.draftMailbox) {
        return new AccountConfigError('draftMailbox');
      } else if (!this.draftMailbox) {
        return new NotFound("Account " + this.account.id + " draftbox " + this.account.draftMailbox);
      } else {
        return null;
      }
    } else {
      if (!this.account.sentMailbox) {
        return new AccountConfigError('sentMailbox');
      } else if (!this.sentMailbox) {
        return new NotFound("Account " + this.account.id + " sentbox " + this.account.sentMailbox);
      } else {
        return null;
      }
    }
  };

  SaveOrSendMessage.prototype.fetchForwardedMessage = function(callback) {
    var hasDSAttachments;
    hasDSAttachments = this.message.attachments.some(isDSAttachment);
    if (hasDSAttachments && !this.oldVersion) {
      log.debug("fetching forwarded original");
      return Message.find(this.message.inReplyTo, (function(_this) {
        return function(err, found) {
          if (err) {
            return callback(err);
          }
          if (!found) {
            return callback(new Error("Not Found Fwd " + _this.message.inReplyTo));
          }
          _this.forwardedMessage = found;
          return callback(null);
        };
      })(this));
    } else {
      return callback(null);
    }
  };

  SaveOrSendMessage.prototype._gatherOne = function(attachment, callback) {
    var bufferer, fileStream, filename, handleBuffer, sourceMsg;
    filename = attachment.generatedFileName;
    sourceMsg = this.forwardedMessage || this.oldVersion;
    handleBuffer = (function(_this) {
      return function(contentBuffer) {
        _this.attachmentsWithBuffers.push({
          content: contentBuffer,
          filename: attachment.fileName,
          cid: attachment.contentId,
          contentType: attachment.contentType,
          contentDisposition: attachment.contentDisposition
        });
        return callback(null);
      };
    })(this);
    if (attachment.url) {
      fileStream = sourceMsg.getBinary(filename, function(err) {
        if (err) {
          return log.error("Attachment streaming error", err);
        }
      });
      bufferer = new stream_to_buffer.Bufferer((function(_this) {
        return function(err, buffer) {
          if (err) {
            return callback(err);
          }
          return handleBuffer(buffer);
        };
      })(this));
      return fileStream.pipe(bufferer);
    } else if (this.newAttachments[filename]) {
      return handleBuffer(this.newAttachments[filename].content);
    } else {
      return callback(new BadRequest('Attachment #{filename} unknown'));
    }
  };

  SaveOrSendMessage.prototype.gatherAttachments = function(callback) {
    var attachmentsWithBuffers;
    log.debug("gathering attachments");
    attachmentsWithBuffers = [];
    return async.eachSeries(this.message.attachments, this._gatherOne, (function(_this) {
      return function(err) {
        _this.message.attachments = _this.attachmentsWithBuffers;
        return callback(err);
      };
    })(this));
  };

  SaveOrSendMessage.prototype.sendMessageSMTP = function(callback) {
    if (this.isDraft) {
      return callback(null);
    }
    log.debug("send#sending");
    return this.account.sendMessage(this.message, (function(_this) {
      return function(err, info) {
        if (err) {
          return callback(err);
        }
        _this.message.headers['message-id'] = info.messageId;
        _this.message.messageID = normalizeMessageID(info.messageId);
        return callback(null);
      };
    })(this));
  };

  SaveOrSendMessage.prototype.removeOldDraftImap = function(callback) {
    if (!this.previousUID) {
      return callback(null);
    }
    log.debug("send#remove_old");
    return this.draftMailbox.imap_removeMail(this.previousUID, callback);
  };

  SaveOrSendMessage.prototype.addToDraftOrSentImap = function(callback) {
    var add;
    if (this.isDraft) {
      this.destinationBox = this.draftMailbox;
      add = this.account.imap_createMail.bind(this.account, this.draftMailbox);
    } else {
      this.destinationBox = this.sentMailbox;
      add = this.sentMailbox.imap_createMailNoDuplicate.bind(this.sentMailbox, this.account);
    }
    return add(this.message, (function(_this) {
      return function(err, uid) {
        _this.uidInDest = uid;
        return callback(err);
      };
    })(this));
  };

  SaveOrSendMessage.prototype.createOrUdateCozy = function(callback) {
    var attachment, binaryReference, filename, i, len, ref1;
    log.debug("send#cozy_create");
    this.message.attachments = this.attachmentsClean;
    this.message.text = this.message.content;
    delete this.message.content;
    if (this.account.isTest()) {
      this.uidInDest = Date.now();
    }
    this.message.mailboxIDs = {};
    this.message.mailboxIDs[this.destinationBox.id] = this.uidInDest;
    this.message.date = new Date().toISOString();
    if (this.forwardedMessage) {
      log.debug("send#linking");
      this.message.binary = {};
      ref1 = this.message.attachments;
      for (i = 0, len = ref1.length; i < len; i++) {
        attachment = ref1[i];
        filename = attachment.generatedFileName;
        if (filename in this.forwardedMessage.binary) {
          binaryReference = this.forwardedMessage.binary[filename];
          this.message.binary[filename] = binaryReference;
        }
      }
    }
    return Message.updateOrCreate(this.message, (function(_this) {
      return function(err, updated) {
        if (err) {
          return callback(err);
        }
        _this.cozyMessage = updated;
        return callback(null);
      };
    })(this));
  };

  SaveOrSendMessage.prototype.attachNewBinaries = function(callback) {
    log.debug("send#attaching");
    return async.eachSeries(Object.keys(this.newAttachments), (function(_this) {
      return function(name, next) {
        var buffer;
        buffer = _this.newAttachments[name].content;
        buffer.path = encodeURI(name);
        return _this.cozyMessage.attachBinary(buffer, {
          name: name
        }, next);
      };
    })(this), callback);
  };

  SaveOrSendMessage.prototype.removeOldBinaries = function(callback) {
    var base, remainingAttachments;
    log.debug("send#removeBinary");
    if ((base = this.cozyMessage).binary == null) {
      base.binary = {};
    }
    remainingAttachments = this.cozyMessage.attachments.map(function(file) {
      return file.generatedFileName;
    });
    return async.eachSeries(Object.keys(this.cozyMessage.binary), (function(_this) {
      return function(name, next) {
        if (indexOf.call(remainingAttachments, name) >= 0) {
          return setImmediate(next);
        } else {
          return _this.cozyMessage.removeBinary(name, next);
        }
      };
    })(this), callback);
  };

  return SaveOrSendMessage;

})(Process);
