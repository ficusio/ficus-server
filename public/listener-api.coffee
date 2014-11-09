window.API = class API

  @PresentationState:
    NOT_STARTED: 'not_started'
    ACTIVE: 'active'
    ENDED: 'ended'

  PresentationState: API.PresentationState

  constructor: (apiEndpoint) ->
    console.log 'new API ' + @apiEndpoint
    @_ = new APIImpl this, apiEndpoint
    @onInitialState = undefined
    @onPollStarted = undefined
    @onPollEnded = undefined
    @onStateChanged = undefined
    @onError = undefined

  voteUp: ->
    console.log 'API.voteUp()'
    @_.voteUp()

  voteDown: ->
    console.log 'API.voteDown()'
    @_.voteDown()

  answer: (index) ->
    console.log 'API.answer: ' + index
    @_.answer index

  sendFeedback: (msg) ->
    console.log "API.sendFeedback: '#{ msg }'"
    @_.sendFeedback msg


####################################################################################################

class APIImpl

  constructor: (@intf, apiEndpoint) ->

    @clientData = utils.obtainClientData()
    @sockjs = new SockJS apiEndpoint
    @active = no

    console.log "clientData: #{ JSON.stringify @clientData, null, '  ' }"

    @sockjs.onopen = (evt) => @on_open evt
    @sockjs.onmessage = (evt) => @on_message evt
    @sockjs.onclose = (evt) => @on_close evt


  send: (type, data = '') ->
    unless @active
      return console.warn "API.send(#{ type }): connection is not established"
    try
      @sockjs.send JSON.stringify { type, data }
    catch e
      console.error "cannot stringify message <#{ type }>: #{ e }"
    undefined


  voteUp: ->
    @send 'vote_up'


  voteDown: ->
    @send 'vote_down'


  answer: (optionIndex) ->
    unless @poll
      return console.warn "API.answer(): no active poll"
    @send 'poll_vote', optionIndex


  sendFeedback: (msg) ->
    @send 'question', msg


  callback: (name, args...) ->
    console.log 'API ~> ' + name, args...
    @intf[name]? args...


  on_open: ->
    console.log 'API [*] open, proto:', @sockjs.protocol
    @active = yes
    { clientId, presentationId } = @clientData
    @send 'init', { clientId, presentationId }


  on_message: (evt) ->
    console.log 'API [.] message:', evt.data
    try
      { type, data } = JSON.parse evt.data
    catch e
      console.error "API: failed to parse incoming message '#{ evt.data }'"
      return
    this[ 'on_' + type ]? data


  on_initial_state: (initialState) ->
    @callback 'onInitialState', initialState


  on_presentation_state: (state) ->
    @callback 'onStateChanged', state


  on_poll: (poll) ->
    @poll = poll
    if poll?
      @callback 'onPollStarted', poll
    else
      @callback 'onPollEnded'


  on_close: (evt) ->
    @active = no
    reason = evt && evt.reason
    console.log 'API [*] close, reason:', reason
    @callback 'onError', reason
