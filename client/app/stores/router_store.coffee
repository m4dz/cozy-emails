_             = require 'lodash'
Immutable     = require 'immutable'
Store         = require '../libs/flux/store/store'
AppDispatcher = require '../libs/flux/dispatcher/dispatcher'

AccountGetter = require '../getters/account'
RequestsStore = require '../stores/requests_store'

MessageGetter  = require '../getters/message'

{AccountActions
ActionTypes
MessageActions} = require '../constants/app_constants'

{MSGBYPAGE} = require '../../../server/utils/constants'
TAB = 'account'


class RouterStore extends Store

    ###
        Initialization.
        Defines private variables here.
    ###
    _router = null
    _action = null
    _URI = null
    _requests = {}

    _messagesPerPage = null;

    _modal = null

    _currentFilter = _defaultFilter =
        sort: '-date'
        flags: null
        value: null
        before: null
        after: null

    _accountID = null
    _mailboxID = null
    _tab = null

    _conversationID = null
    _messageID = null
    _messagesLength = 0
    _nearestMessage = null



    # Paginate Messages.list
    _pages = {}
    _requests = {}
    _currentRequest = null

    _timerRouteChange = null

    getRouter: ->
        _router

    getAction: ->
        _action


    getFilter: ->
        _currentFilter


    getModalParams: ->
        _modal


    getURL: (options={}) ->
        params = _.cloneDeep options
        action = _getRouteAction params

        isMessage = !!params.messageID or _.includes action, 'message'
        isMailbox = _.includes action, 'mailbox'
        if (isMessage or isMailbox) and not params.mailboxID
            unless (params.mailboxID = @getMailboxID())
                account = @getDefaultAccount()
                params.accountID = account?.get 'id'
                params.mailboxID = account?.get 'inboxMailbox'

        isAccount = _.includes action, 'account'
        if isAccount and not params.accountID
            unless (params.accountID = @getAccountID())
                params.accountID = @getDefaultAccount()?.get 'id'

        if isAccount and not params.tab
            params.tab = 'account'

        return unless (route = _getRoute action)

        prefix = unless params.isServer then '#' else ''
        query = _getURIQueryParams params
        query = '/' + query if params.isServer

        prefix + route.replace(/\(\?:filter\)$/, query)
                .replace /\:\w*/gi, (match) ->
                    # Get Route pattern of action
                    # Replace param name by its value
                    param = match.substring 1, match.length
                    params[param] or match



    getCurrentURL: (options={}) ->
        return unless (@getAction() or options.action)

        params = _.cloneDeep options
        params.isServer ?= true
        params.action ?= @getAction()
        params.mailboxID ?= @getMailboxID()
        params.messageID ?= @getMessageID()
        params.conversationID ?= @getConversationID()
        return @getURL params



    getNextRequest: ->
        _getNextRequest()


    # Save messagesLength per page
    # to get the correct pageAfter param
    # for getNext handles
    _setLastPage = (messages) ->
        # Sort messages by date
        messages = messages.sort (msg1, msg2) ->
            _sortValues msg1.date, msg2.date

        # Get query of fetchRequest
        # all messages should be older than pageAfter
        pageAfter = _.last(messages)?.date
        currentValue = _requests[_URI]

        # If messages fetched are older
        # than the current request
        if currentValue?.start? and currentValue.start < pageAfter
            pageAfter = currentValue.start

        # Prepare next fetch request
        _setNextRequest {pageAfter}

        # Save request state
        counter = _self.getMailbox()?.get 'nbTotal'
        _requests[_URI] = {
            page: _getPage(),
            start: pageAfter,
            isComplete: counter is _messagesLength,
        }


    _getNextRequest = ->
        _requests[_getNextURI()]


    _setCurrentRequest = (url) ->
        key = _getPreviousURI()
        _currentRequest = if url isnt _requests[key] then url else null


    _getPage = ->
        _pages[_URI] ?= -1
        _pages[_URI]


    _addPage = ->
        _pages[_URI] ?= -1
        ++_pages[_URI]


    _getNextURI = ->
        "#{_URI}-#{_getPage()}"


    _getPreviousURI = ->
        if (page = _getPage()) > 0
            "#{_URI}-#{--page}"


    _getPreviousURL = ->
        if (key = _getPreviousURI())?
            _requests[key]


    # Get URL from last fetch result
    # not from the list that is not reliable
    _setNextRequest = ({pageAfter}) ->
        _addPage()

        # Do not overwrite result
        # that has no reasons to changes
        if _getNextRequest() is undefined
            action = MessageActions.SHOW_ALL
            filter = {pageAfter}
            currentURL = _self.getCurrentURL {filter, action}
            if _getPreviousURL() isnt currentURL
                _requests[_getNextURI()] = currentURL


    _getRouteAction = (params) ->
        unless (action = params.action)
            if params.messageID
                action = MessageActions.SHOW
            else if AccountGetter.getAll()?.size
                action = MessageActions.SHOW_ALL
            else
                action = AccountActions.CREATE
        action

    _getRoute = (action) ->
        if (routes = _router?.routes)
            name = _toCamelCase action
            index = _.values(routes).indexOf(name)
            _.keys(routes)[index]


    _getURIQueryParams = (params={}) ->
        _filter = _.clone _defaultFilter
        {filter, resetFilter, isServer} = params
        _.extend _filter, _currentFilter, filter unless resetFilter

        query = _.compact _.map _filter, (value, key) ->
            if value? and _defaultFilter[key] isnt value
                # Server Side request:
                # Flags query doesnt exist
                key = 'flag' if isServer and key is 'flags'
                value = value.join '&' if _.isArray value
                return key + '=' + value

        if query.length then '?' + encodeURI query.join '&' else ''


    _setFilter = (query=_defaultFilter) ->
        # Update Filter
        _currentFilter = _.clone _defaultFilter
        _.extend _currentFilter, query
        return _currentFilter


    _sortByDate = (order) ->
        order = if order is '+' then -1 else 1
        return (message1, message2) ->
            val1 = message1.get('date')
            val2 = message2.get('date')
            _sortValues val1, val2, order


    _sortValues = (val1, val2, order=1) ->
        if val1 > val2 then return -1 * order
        else if val1 < val2 then return 1 * order
        else return 0

    # Useless for MessageGetter
    # to clean messages
    isResetFilter: (filter) ->
        filter = @getFilter() unless filter
        filter.type in ['from', 'dest']

    _setCurrentAccount = ({accountID=null, mailboxID=null, tab=TAB}) ->
        _accountID = accountID
        _mailboxID = mailboxID
        _tab = if _action is AccountActions.EDIT then tab else null


    _getFlags = (message) ->
        flags = if message?
        then message?.get 'flags'
        else _currentFilter?.flags
        flags = [flags] if _.isString flags
        flags or []


    getAccount: (accountID) ->
        accountID ?= _accountID
        AccountGetter.getByID accountID


    getAccountID: (mailboxID) ->
        if mailboxID
            return AccountGetter.getByMailbox('mailboxID')?.get 'id'
        else
            return _accountID


    getDefaultAccount: ->
        AccountGetter.getAll().first()


    getMailboxID: (messageID) ->
        if messageID
            # Get mailboxID from message first
            mailboxIDs = MessageGetter.getByID(messageID)?.get 'mailboxIDs'
            if _mailboxID in _.keys(mailboxIDs)
                return _mailboxID

        return _mailboxID


    getMailbox: (accountID, mailboxID) ->
        accountID ?= @getAccountID()
        mailboxID ?= @getMailboxID()
        AccountGetter.getMailbox accountID, mailboxID


    getAllMailboxes: (accountID) ->
        accountID ?= @getAccountID()
        AccountGetter.getAllMailboxes accountID



    getDefaultTab: ->
        TAB


    getSelectedTab: ->
        _tab


    _setCurrentMessage = ({conversationID, messageID}) ->
        # Return to message list
        # if no messages are found
        if not messageID or not conversationID
            conversationID = null
            messageID = null

        _conversationID = conversationID
        _messageID = messageID
        _messagesLength = 0


    _setCurrentAction = (payload={}) ->
        {action, accountID, mailboxID, messagesPerPage} = payload
        {messageID, conversationID} = payload

        if AccountGetter.getAll()?.size
            if mailboxID
                if messageID and conversationID
                    action = MessageActions.SHOW
                else if accountID and action isnt AccountActions.EDIT
                    action = MessageActions.SHOW_ALL

        if action in [MessageActions.SHOW, MessageActions.SHOW_ALL]
            _messagesPerPage = messagesPerPage or MSGBYPAGE
        else
            _messagesPerPage = null

        _action = action or AccountActions.CREATE


    getConversationID: ->
        _conversationID

    # Get default message of a conversation
    # if conversationID is in argument
    # otherwhise, return global messageID (from URL)
    getMessageID: (conversationID) ->
        if conversationID?
            messages = @getConversation conversationID

            # At first get unread Message
            # if not get last message
            message = messages.find (message) => @isUnread message
            message ?= messages.shift()
            message?.get 'id'
        else
            _messageID


    isUnread: (message) ->
        flags = _getFlags message
        return MessageGetter.isUnread({flags, message}) or
                    @getMailboxID() is @getAccount()?.get('unreadMailbox')


    isFlagged: (message) ->
        flags = _getFlags message
        return MessageGetter.isFlagged({flags, message}) or
                    @getMailboxID() is @getAccount()?.get('flaggedMailbox')


    isAttached: (message) ->
        flags = _getFlags message
        MessageGetter.isAttached {flags, message}


    isDeleted: (message) ->
        # Message is in trashbox
        if message?
            account = AccountGetter.getByID message.get('accountID')
            trashboxID = account?.get 'trashMailbox'
            return message.get('mailboxIDs')[trashboxID]?

        # Mailbox selected is trashbox
        trashboxID = @getAccount()?.get 'trashMailbox'
        trashboxID? and trashboxID is @getMailboxID()


    isDraft: (message) ->
        if message?
            flags = _getFlags message
            MessageGetter.isDraft {flags, message}
        else
            draftID = @getAccount()?.get 'draftMailbox'
            draftID? and draftID is @getMailboxID()


    getMailboxTotal: ->
        if @isUnread()
            props = 'nbUnread'
        else if @isFlagged()
            props = 'nbFlagged'
        else
            props = 'nbTotal'
        @getMailbox()?.get(props) or 0


    hasNextPage: ->
        not @getLastFetch()?.isComplete


    getLastFetch: ->
        _requests[_URI]


    # MessageList have a minLength
    # if its size < minLength then return false
    # otherwhise return true
    isPageComplete: ->
        # Do not infinite fetch
        # when message doesnt exist anymore
        messageID = @getMessageID()
        if messageID and not MessageGetter.getByID(messageID)?.size
            return @hasNextPage()

        # Do not get all messages
        # be enought to "feel" the page
        accountID = @getAccountID()
        mailboxID = @getMailboxID()
        nbTotal = AccountGetter.getMailbox(accountID, mailboxID)?.get 'nbTotal'
        maxMessage = if nbTotal < _messagesPerPage then --nbTotal else _messagesPerPage

        _messagesLength >= maxMessage


    filterByFlags: (message) =>
        if message and message not instanceof Immutable.Map
            message = Immutable.Map message

        if @isFlagged()
            return @isFlagged message
        if @isAttached()
            return @isAttached message
        if @isUnread()
            return @isUnread message
        return true


    getMessagesList: (accountID, mailboxID) ->
        accountID ?= @getAccountID()
        mailboxID ?= @getMailboxID()

        inbox = AccountGetter.getInbox accountID
        inboxID = (inbox = AccountGetter.getInbox accountID)?.get 'id'
        inboxTotal = inbox?.get 'nbTotal'
        isInbox = AccountGetter.isInbox accountID, mailboxID

        {sort} = @getFilter()
        sortOrder = parseInt "#{sort.charAt(0)}1", 10

        conversations = {}
        messages = MessageGetter.getAll()?.filter (message) =>
            # do not have twice INBOX
            # see OVH twice Inbox issue
            # FIXME: should be executed server side
            # add inboxID for its children
            _.keys(message.get 'mailboxIDs').forEach (id) ->
                isInboxChild = AccountGetter.isInbox accountID, id, true
                if not isInbox and isInboxChild
                    mailboxIDs = message.get 'mailboxIDs'
                    mailboxIDs[inboxID] = inboxTotal
                    message.set 'mailboxIDs', mailboxIDs
                    return true

            # Display only last Message of conversation
            path = [message.get('mailboxID'), message.get('conversationID')].join '/'
            conversations[path] = true unless (exist = conversations[path])

            # Should have the same flags
            hasSameFlag = @filterByFlags message

            # Message should be in mailbox
            inMailbox = mailboxID of message.get 'mailboxIDs'

            return inMailbox and not exist and hasSameFlag
        .sort _sortByDate sortOrder
        .toOrderedMap()

        _messagesLength = messages.size

        return messages


    # Get next message from conversation:
    # - from the same mailbox
    # - with the same filters
    # - otherwise get previous message
    # If conversation is empty:
    # - go to next conversation
    # - otherwise go to previous conversation
    getNearestMessage: (target={}, type='conversation') ->
        {messageID, conversationID, mailboxID} = target
        unless messageID
            messageID = _messageID
            conversationID = _conversationID
            mailboxID = _mailboxID

        if 'conversation' is type
            conversation = _self.getConversation conversationID, mailboxID
            message = _self.getNextConversation conversation
            message ?= _self.getPreviousConversation conversation
            return message if message?.size

        message = _self.getNextConversation()
        message ?= _self.getPreviousConversation()
        message


    getConversation: (conversationID, mailboxID) ->
        conversationID ?= @getConversationID()
        unless conversationID
            return []

        # Filter messages
        mailboxID ?= @getMailboxID()
        messages = MessageGetter.getConversation conversationID, mailboxID
        _.filter messages, @filterByFlags


    _getConversationIndex = (messages) ->
        keys = _.map messages, (message) -> message.get 'id'
        keys.indexOf _messageID


    getNextConversation: (messages) ->
        messages ?= @getMessagesList()?.toArray()
        index = _getConversationIndex messages
        messages[--index]


    getPreviousConversation: (messages) ->
        messages ?= @getMessagesList()?.toArray()
        index = _getConversationIndex messages
        messages[++index]


    getConversationLength: (conversationID) ->
        conversationID ?= @getConversationID()
        MessageGetter.getConversationLength conversationID


    getURI: ->
        _URI


    getMessagesPerPage: ->
        _messagesPerPage


    _updateURL = ->
        currentURL = _self.getCurrentURL isServer: false
        if location?.hash isnt currentURL
            _router.navigate currentURL


    _setURI = ->
        # Special Case ie. OVH mails
        # sometime there are several INBOX with different id
        # but only one is references as real INBOX
        # Get reference INBOX_ID to keep _requests works
        # with this 2nd INBOX
        if AccountGetter.isInbox _accountID, _mailboxID
            mailboxID = AccountGetter.getInbox(_accountID)?.get 'id'
        else
            mailboxID = _mailboxID

        params = {
            action: _action,
        };

        if _action in _.values(MessageActions)
            Object.assign params, {
                accountID: _accountID,
                mailboxID: _mailboxID,
            }

            unless MessageActions.SHOW_ALL is _action
                Object.assign params, {
                    conversationID: _conversationID,
                    messageID: _messageID,
                }

            # Query are only for Messages
            if (query = _getURIQueryParams { filter: _currentFilter })
                Object.assign params, { query }

        else if AccountActions.EDIT is _action
            Object.assign params, {
                accountID: _accountID,
            }

        # Do not add empty query
        params = _.flatten _.transform params, (result, value, key) =>
            return if 'query' is key and _.isEmpty(value)
            result.push key + '=' + value
        , []

        _URI = _.flatten(params).join '&'


    ###
        Defines here the action handlers.
    ###
    __bindHandlers: (handle) ->

        handle ActionTypes.MESSAGE_RESET_REQUEST, ->
            _messagesPerPage = null;
            _requests = {}
            @emit 'change'


        handle ActionTypes.ROUTE_CHANGE, (payload={}) ->
            # Ensure all stores that listen ROUTE_CHANGE have vanished
            AppDispatcher.waitFor [RequestsStore.dispatchToken]

            # Make sure that MessageGetter is up to date
            # before gettings data from it
            AppDispatcher.waitFor [MessageGetter.dispatchToken]

            clearTimeout _timerRouteChange

            {accountID, mailboxID} = payload
            {tab, filter} = payload
            {filter} = payload

            # We cant display any informations
            # without accounts
            _setCurrentAction payload

            # get Account from mailbox
            if mailboxID
                accountID ?= AccountGetter.getByMailbox(mailboxID)?.get 'id'

            # Get default account
            # and set accountID and mailboxID
            if not accountID and not mailboxID
                account = AccountGetter.getDefault()
                accountID = account?.get 'id'
                mailboxID = account?.get 'inboxMailbox'

            mailboxID ?= AccountGetter.getByID(accountID)?.get 'inboxMailbox'
            _setCurrentAccount {accountID, mailboxID, tab}

            # From MessageGetter
            # Update currentMessageID
            _setCurrentMessage payload

            # Handle all Selection
            # _resetSelection()

            # Save current filters
            _setFilter filter


            # Update URL if it didnt
            _updateURL()

            # Save URI
            # used for paginate
            _setURI()

            @emit 'change'


        handle ActionTypes.ROUTES_INITIALIZE, (router) ->
            _router = router

            _action = null
            _URI = null
            _requests = {}

            _modal = null

            _currentFilter = _defaultFilter =
                sort: '-date'
                flags: null
                value: null
                before: null
                after: null

            _accountID = null
            _mailboxID = null
            _tab = null

            _conversationID = null
            _messageID = null
            _messagesLength = 0
            _nearestMessage = null

            clearTimeout _timerRouteChange if _timerRouteChange
            _timerRouteChange = null

            @emit 'change'


        # Do not redirect to default account
        # if silent is true
        handle ActionTypes.REMOVE_ACCOUNT_SUCCESS, ({silent})  ->
            account = @getDefaultAccount()
            accountID = account?.get 'id'
            mailboxID = account?.get 'inboxMailbox'
            _setCurrentAccount {accountID, mailboxID}

            unless silent
                action = AccountActions[if account then 'EDIT' else 'CREATE']
                _setCurrentAction {action}

            _updateURL()

            @emit 'change'


        handle ActionTypes.MESSAGE_FETCH_SUCCESS, ({result, conversationID, url}) ->
            _setCurrentRequest url

            # Save last message references
            _setLastPage result.messages if result?.messages

            # If messageID doesnt belong to conversation
            # message must have been deleted
            # then get default message from this conversation
            if conversationID
                inner = _.find result?.messages, (msg) -> msg.id is _messageID
                unless inner
                    messageID = @getMessageID conversationID
                    _setCurrentMessage {conversationID, messageID}
                    _updateURL()

            @emit 'change'


        handle ActionTypes.MESSAGE_FETCH_FAILURE, ({ error, URI }) ->
            if (error is 'NEXT_PAGE_IS_NULL')
                _requests[URI].isComplete = true
            @emit 'change'


        handle ActionTypes.DISPLAY_MODAL, (params) ->
            _modal = params
            @emit 'change'

        handle ActionTypes.HIDE_MODAL, ->
            _modal = null
            @emit 'change'


        handle ActionTypes.MESSAGE_FLAGS_SUCCESS, ->
            @emit 'change'


        # Get nearest message from message to be deleted
        # to make redirection if request is successful
        handle ActionTypes.MESSAGE_TRASH_REQUEST, ({target}) ->
            if target.messageID is _messageID
                _nearestMessage = @getNearestMessage target
            @emit 'change'


        # Select nearest message from deleted message
        # and remove message from mailbox and conversation lists
        handle ActionTypes.MESSAGE_TRASH_SUCCESS, ({target}) ->
            if target.messageID is _messageID
                messageID = _nearestMessage?.get 'id'
                conversationID = _nearestMessage?.get 'conversationID'

                # Update currentMessage so that:
                # - all counters should be updated
                # - all messagesList should be updated too
                _setCurrentMessage {conversationID, messageID}
                _updateURL()

            @emit 'change'


        # Delete nearestMessage
        # because it's beacame useless
        handle ActionTypes.MESSAGE_TRASH_FAILURE, ({target}) ->
            if target.messageID is _messageID
                _nearestMessage = null
            @emit 'change'


        handle ActionTypes.RECEIVE_MESSAGE_DELETE, (messageID, deleted) ->
            if messageID is _messageID
                _nearestMessage = @getNearestMessage deleted

                messageID = _nearestMessage?.get 'id'
                conversationID = _nearestMessage?.get 'conversationID'

                # Update currentMessage so that:
                # - all counters should be updated
                # - all messagesList should be updated too
                _setCurrentMessage {conversationID, messageID}
                _updateURL()

            @emit 'change'


        handle ActionTypes.SETTINGS_UPDATE_REQUEST, ->
            @emit 'change'



_toCamelCase = (value) ->
    return value.replace /\.(\w)*/gi, (match) ->
        part1 = match.substring 1, 2
        part2 = match.substring 2, match.length
        return part1.toUpperCase() + part2


module.exports = (_self = new RouterStore())
