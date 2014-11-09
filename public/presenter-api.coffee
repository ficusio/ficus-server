window.API = class API

  @PresentationState:
    NOT_STARTED: 'not_started'
    ACTIVE: 'active'
    ENDED: 'ended'

  PresentationState: API.PresentationState


  constructor: (apiEndpoint) ->
    console.log 'new API ' + @apiEndpoint
    @_ = new APIImpl this, apiEndpoint

  start: ->
    console.log "API.start()"
    @_.start()

  setSlideId: (id) ->
    console.log "API.setSlideId(#{id})"
    @_.setSlideId id

  finish: ->
    console.log "API.finish()"
    @_.finish()

  startPoll: (id, poll) ->
    console.log "API.startPoll(#{id}, #{JSON.stringify poll, null, '  '})"
    @_.startPoll id, poll

  finishPoll: ->
    console.log "API.finishPoll()"
    @_.finishPoll()


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


  callback: ->


  start: ->
    @send 'start'


  finish: ->
    @send 'finish'


  setSlideId: (id) ->
    @send 'slide', id


  startPoll: (id, poll) ->
    poll.id = id
    @send 'poll_start', poll


  finishPoll: ->
    @send 'poll_finish'


  on_open: ->
    console.log 'API [*] open, proto:', @sockjs.protocol
    @active = yes
    { clientId, presentationId } = @clientData
    @send 'init', { clientId, presentationId, isPresenter: yes }


  on_message: (evt) ->
    console.log 'API [.] message:', evt.data
    try
      { type, data } = JSON.parse evt.data
    catch e
      console.error "API: failed to parse incoming message '#{ evt.data }'"
      return
    this[ 'on_' + type ]? data


  on_close: (evt) ->
    @active = no
    reason = evt && evt.reason
    console.log 'API [*] close, reason:', reason
    @callback 'onError', reason
