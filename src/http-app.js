var debug = require('debug')('app:http'),
    config = require('./config'),
    path = require('path'),
    uuid = require('node-uuid'),
    _ = require('lodash');


// App

var app = require('koa')();
app.keys = config.crypto.cookieKeys;


app.use(require('koa-session')({
  signed: true,
  httpOnly: true
}));


// File server

var publicDir = path.join(__dirname, '..', 'public'),
    sendFile;


if (process.env.NODE_ENV == 'dev')
{
  var send = require('koa-send'),
      serve = require('koa-static');

  sendFile = function* (ctx, path) {
    debug(path);
    yield send(ctx, path, { root: publicDir });
  };

  app.use(serve(publicDir, { index: '__disable__' }));
}
else
{
  var fileServer = require('koa-file-server')({
    root: publicDir,
    index: false,
    maxage: 0
  });

  sendFile = function* (ctx, path) {
    yield* fileServer.send(ctx, path);
  };

  app.use(fileServer);
}


// Routes

var Router = require('koa-router'),
    router = new Router(),
    store = require('./store');


router.get('/', function* ()
{
  var presentation = store.getActivePresentation();
  updateCookie(this, presentation, this.query.newId);
  yield* sendFile(this, 'listener.html');
});


router.get('/register-presentation/:id', function* ()
{
  var presentation = store.getPresentationById(this.params.id, true),
      clientData = updateCookie(this, presentation);
  presentation.setPresenterId(clientData.clientId);
  this.body = 'ok';
});


router.get('/presenter', function* ()
{
  var presentation = store.getActivePresentation(),
      clientData = updateCookie(this, presentation);

  if (clientData.clientId == presentation.presenterId)
  {
    return yield* sendFile(this, 'presenter.html');
  }
  
  this.status = 401;
});


router.get('/test-presenter', function* ()
{
  var presentation = store.getPresentationById(uuid(), true),
      clientData = updateCookie(this, presentation, uuid());

  presentation.setPresenterId(clientData.clientId);
  
  return yield* sendFile(this, 'presenter.html');
});


app.use(router.middleware());


// Cookies

var cookieGetOps = {
  signed: true,
  httpOnly: false
};

var cookieSetOps = _.extend({}, cookieGetOps),
    MS_IN_YEAR = 1000 * 60 * 60 * 24 * 365;

function updateCookie (ctx, presentation, setClientId = null)
{
  var serializedData = ctx.cookies.get('cd', cookieGetOps),
      clientData,
      clientDataUpdated = false;

  if (serializedData == null)
  {
    clientData = {};
  }
  else {
    try {
      clientData = new Buffer(serializedData, 'base64');
      clientData = JSON.parse(clientData.toString());
    }
    catch (e)
    {
      clientData = {};
      console.error(`failed deserializing client cookie: ${ e }`);
    }
  }

  if (clientData.clientId == null || setClientId != null)
  {
    clientData.clientId = setClientId || uuid();
    clientDataUpdated = true;
    debug('new client id set:', clientData.clientId);
  }

  if (presentation && clientData.presentationId != presentation.id)
  {
    clientData.presentationId = presentation.id;
    clientDataUpdated = true;
    debug('presentation id set:', clientData.presentationId);
  }

  if (clientDataUpdated)
    serializedData = new Buffer(JSON.stringify(clientData)).toString('base64');

  cookieSetOps.expires = new Date( Date.now() + MS_IN_YEAR );
  ctx.cookies.set('cd', serializedData, cookieSetOps);

  return clientData;
}


module.exports = app.callback();
