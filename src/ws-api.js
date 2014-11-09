
module.exports = onNewConnection;


var debug = require('debug')('app:ws-api'),
    ClientConnection = require('./client-connection'),
    store = require('./store'),
    P = require('./ws-protocol'),
    MESSAGE = P.message;


var stateByPresentationId = {},
    connectionsByClientId = {};


function onNewConnection (sockJSConn)
{
  debug('new SockJS connection');
  
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

  conn.once('close', onPresenterLeft);
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

  // TODO: send initial state

  conn.once('close', onClientLeft);
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


function broadcast (presentationId, type, data)
{
  debug(`~> presentation ${ presentation.id } broadcast <${ type }>:`, data);

  var str = stringifyMessage(type, data);
  if (str == null) return;

  var { connections } = stateForPresentationId(presentationId),
      totalConnections = connections.length;

  debug(`   total ${ totalConnections } connections`);

  for (var i = 0; i < totalConnections; ++i)
  {
    connections[i].write(str);
  }
}


function stateForPresentationId (presentationId)
{
  var state = stateByPresentationId[ presentationId ];
  if (state == null)
  {
    stateByPresentationId[ presentationId ] = state = 
    {
      presentationId: presentationId,
      presenter: null,
      connections: []
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
