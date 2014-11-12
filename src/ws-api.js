
module.exports = onNewConnection;


var debug = require('debug')('app:ws-api'),
    ClientConnection = require('./client-connection'),
    store = require('./store'),
    P = require('./ws-protocol'),
    MESSAGE = P.message,
    TwitterWatcher = require('./twitter-watcher'),
    twitterConfig = require('./config').twitter,
    _ = require('lodash');


var stateByPresentationId = {},
    connectionsByClientId = {},
    MEAN_MOOD_UPDATE_INTERVAL = 500,
    meanMoodIntvId = -1,
    twitterWatcher;


function onNewConnection (sockJSConn)
{
  debug('new SockJS connection: ' + sockJSConn);
  
  var conn = new ClientConnection(sockJSConn);
  conn.once(MESSAGE.inp_init, onClientInit);
}


function onClientInit (conn)
{
  var presentation = store.getPresentationById(conn.presentationId);
  if (presentation == null)
  {
    debug(`found no presentation with id ${ conn.presentationId } for client ${ conn.clientId }`);
    return conn.close(P.code.presentation_not_found);
  }

  if (conn.isPresenter)
  {
    var presenterId = presentation.presenterId;
    if (presenterId != conn.clientId)
    {
      debug(`unauthorized presenter ${ conn.clientId }`);
      return conn.close(P.code.unauthorized);
    }
    return onPresenter(conn, presentation, stateForPresentationId(presentation.id));
  }

  onClient(conn, presentation, stateForPresentationId(presentation.id));
}


function onPresenter (conn, presentation, presentationState)
{
  var { clientId } = conn;

  debug(`presenter ${ clientId } connected to presentation ${ presentation.id }`);

  presentation.setPresenterId(clientId);
  presentationState.presenter = conn;
  connectionsByClientId[ clientId ] = conn;

  // TODO: send initial state

  conn.on(MESSAGE.inp_pres_start, onPresenterStart);
  conn.on(MESSAGE.inp_pres_finish, onPresenterFinish);
  conn.on(MESSAGE.inp_pres_poll_start, onPresenterPollStart);
  conn.on(MESSAGE.inp_pres_poll_finish, onPresenterPollFinish);

  conn.once('close', onPresenterLeft);

  var initialState = {
    state: presentation.state,
    totalClients: presentation.totalClients
  };

  if (presentation.slideId != null)
  {
    initialState.slideId = presentation.slideId;
  }

  if (presentation.poll != null)
  {
    initialState.poll = presentation.poll.poll;
    initialState.pollResults = presentation.poll.results;
  }

  conn.send(MESSAGE.out_initial_state, initialState);
}


function onPresenterStart (conn)
{
  var presentation = store.getPresentationById(conn.presentationId);
  if (presentation && presentation.start()) {
    broadcast(presentation, MESSAGE.out_presentation_state, presentation.state);
    startMeanMoodWatchingForPresentation(presentation);
    startWatchingTwitter();
  }
}


function onPresenterFinish (conn)
{
  var presentation = store.getPresentationById(conn.presentationId);
  if (presentation && presentation.finish())
  {
    broadcast(presentation, MESSAGE.out_presentation_state, presentation.state);
    stopMeanMoodWatchingForPresentation(presentation);
    stopWatchingTwitter();
  }
}


function onPresenterPollStart (conn, poll)
{
  var presentation = store.getPresentationById(conn.presentationId);
  if (presentation == null) return;
  var results = presentation.startPollAndGetCurrentResults(poll);
  notifyPresenter(presentation, MESSAGE.out_pres_poll_results, results);
  broadcast(presentation, MESSAGE.out_poll, poll);
}


function onPresenterPollFinish (conn)
{
  var presentation = store.getPresentationById(conn.presentationId);
  if (presentation == null) return;
  var results = presentation.stopPoll();
  broadcast(presentation, MESSAGE.out_poll, false);
}


function onClient (conn, presentation, presentationState)
{
  var { clientId } = conn;

  debug(`client ${ clientId } connected to presentation ${ presentation.id }`);

  presentationState.connections.push(conn);
  connectionsByClientId[ clientId ] = conn;

  debug('  now total client connections:', presentationState.connections.length);

  var newTotal = presentation.addNewClientAndGetTotal(clientId);
  notifyPresenter(presentation, MESSAGE.out_pres_total_listeners, newTotal);

  conn.on(MESSAGE.inp_list_vote_up, onClientVoteUp);
  conn.on(MESSAGE.inp_list_vote_down, onClientVoteDown);
  conn.on(MESSAGE.inp_list_question, onClientQuestion);
  conn.on(MESSAGE.inp_list_poll_vote, onClientPollVote);

  conn.once('close', onClientLeft);

  var initialState = { state: presentation.state };

  var client = presentation.getClientById(clientId),
      pollWithResults;

  if (pollWithResults = presentation.poll)
  {
    initialState.poll = pollWithResults.poll;

    var pollVote = client.votesByPollId[ pollWithResults.poll.id ];
    if (pollVote >= 0)
    {
      initialState.pollVote = pollVote;
    }
  }

  conn.send(MESSAGE.out_initial_state, initialState);
}


function onClientVoteUp (conn)
{
  var presentation = store.getPresentationById(conn.presentationId);
  if (presentation == null) return;
  presentation.voteUp(conn.clientId);
}


function onClientVoteDown (conn)
{
  var presentation = store.getPresentationById(conn.presentationId);
  if (presentation == null) return;
  presentation.voteDown(conn.clientId);
}


function onClientQuestion (conn, msg)
{
  var presentation = store.getPresentationById(conn.presentationId);
  if (presentation == null) return;
  var message = {
    type: P.message_type.inapp,
    message: msg,
    userId: conn.clientId,
  };
  presentation.addMessage(msg);
  notifyPresenter(presentation, MESSAGE.out_pres_question, message);
}


function onClientPollVote (conn, optionIndex)
{
  var presentation = store.getPresentationById(conn.presentationId);
  if (presentation == null) return;
  var pollResults = presentation.answerPollAndGetResults(conn.clientId, optionIndex);
  pollResults && notifyPresenter(presentation, MESSAGE.out_pres_poll_results, pollResults);
}


function onPresenterLeft (conn)
{
  var { clientId, presentationId } = conn;

  debug(`presenter ${ clientId } left from presentation ${ presentationId }`);

  var presentationState = stateForPresentationId(presentationId);
  presentationState.presenter = null;
  
  cleanUpPresentationStateIfNeeded(presentationState);
}


function onClientLeft (conn)
{
  var { clientId, presentationId } = conn;

  debug(`client ${ clientId } left from presentation ${ presentationId }`);

  var presentationState = stateForPresentationId(presentationId),
      connections = presentationState.connections,
      index = connections.indexOf(conn);

  if (index >= 0)
  {
    connections.splice(index, 1);
  }
  else {
    debug(`  client ${ clientId } not found in presentation ${ presentationId }`);
  }

  debug('  now total client connections:', connections.length);

  delete connectionsByClientId[ clientId ];

  var presentation = store.getPresentationById(presentationId);
  if (presentation)
  {
    var newTotal = presentation.markClientAbsentAndGetTotal(clientId);
    notifyPresenter(presentation, MESSAGE.out_pres_total_listeners, newTotal);
  }

  cleanUpPresentationStateIfNeeded(presentationState);
}


function notifyPresenter (presentation, type, data)
{
  debug(`~> presentation ${ presentation.id } to presenter <${ type }>:`, data);

  var presenter = stateForPresentationId(presentation.id).presenter;
  if (presenter == null) return debug('   no presenter');

  presenter.send(type, data);
}


var { stringifyMessage } = ClientConnection;


function broadcast (presentation, type, data)
{
  debug(`~> presentation ${ presentation.id } broadcast <${ type }>:`, data);

  var str = stringifyMessage(type, data);
  if (str == null) return;

  var { connections } = stateForPresentationId(presentation.id),
      totalConnections = connections.length;

  debug(`   total ${ totalConnections } connections`);

  for (var i = 0; i < totalConnections; ++i)
  {
    connections[i].write(str);
  }
}


function stateForPresentationId (presentationId, createIfMissing = true)
{
  var state = stateByPresentationId[ presentationId ];
  if (state == null && createIfMissing)
  {
    stateByPresentationId[ presentationId ] = state = 
    {
      presentationId: presentationId,
      connections: [],
      presenter: undefined,
      moodTimerId: undefined,
      lastReportedMood: undefined
    };
    debug(`created an empty state for presentation with id ${ presentationId }`);
  }
  return state;
}


function cleanUpPresentationStateIfNeeded (presentationState)
{
  if (presentationState.presenter == null && presentationState.connections.length == 0)
  {
    delete stateByPresentationId[ presentationState.presentationId ];
    debug(`removed empty state for presentation with id ${ presentationState.presentationId }`);
  }
}


function startMeanMoodWatchingForPresentation (presentation)
{
  var presentationId = presentation.id,
      state = stateForPresentationId(presentationId, false);

  if (state == null)
    return debug(`no state found for presentation ${ presentationId }`);

  state.meanMoodIntvId = setInterval(() => {
    try {
      updateMeanMood(presentation, state);
    }
    catch (e) {
      console.error(`error updating mean mood for presentation ${ presentationId }: ${
        (e && e.stack) || e
      }`);
    }
  }, MEAN_MOOD_UPDATE_INTERVAL);
}


function stopMeanMoodWatchingForPresentation (presentation)
{
  var state = stateForPresentationId(presentation.id, false);
  if (state && state.meanMoodIntvId != null)
  {
    clearInterval(state.meanMoodIntvId);
    state.meanMoodIntvId = undefined;
  }
}


function updateMeanMood (presentation, state)
{
  var mood = Math.floor( 100 * presentation.updateMood() ) / 100;
  if (mood != state.lastReportedMood)
  {
    state.lastReportedMood = mood;
    notifyPresenter(presentation, MESSAGE.out_pres_audience_mood, mood);
  }
}


function startWatchingTwitter (hashtag = null)
{
  stopWatchingTwitter();

  if (twitterConfig)
  {
    var opts = _.extend({}, twitterConfig);
    if (hashtag) opts.watchTags.push(hashtag);
    twitterWatcher = new TwitterWatcher(opts);
    twitterWatcher.on(TwitterWatcher.NEW_TWEET, onNewTweet);
    twitterWatcher.startWatch();
  }
  else {
    debug('startWatchingTwitter: no twitter config');
  }
}


function stopWatchingTwitter ()
{
  if (twitterWatcher)
  {
    twitterWatcher.stopWatch();
    twitterWatcher.removeAllListeners();
    twitterWatcher = null;
  }
}


function onNewTweet (tweet)
{
  debug('new tweet: ' + JSON.stringify(tweet, null, '  '));

  var presentation = store.getActivePresentation();
  if (presentation == null) return;

  notifyPresenter(presentation, MESSAGE.out_pres_question, {
    type: 'twitter',
    message: tweet.text,
    userId: tweet.user
  });
}
