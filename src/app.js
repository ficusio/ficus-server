var debug = require('debug')('app:main'),
    koa = require('koa'),
    sockjs = require('sockjs');

var config = require('./config'),
    server = require('http').createServer(require('./http-app')),
    wsApiServer = sockjs.createServer({ sockjs_url: config.sockjsUrl });

wsApiServer.on('connection', require('./ws-api'));

wsApiServer.installHandlers(server, {
  prefix: config.websocketApiPrefix
});
//server.addListener('upgrade', (req, res) => res.end());

server.listen( config.net.port, config.net.host, init);

function init()
{
  var addr = server.address();
  console.log(`listening on ${ addr.address }:${ addr.port }`);
  
  if (config.runAs)
  {
    process.setgid(config.runAs.group);
    process.setuid(config.runAs.user);
    console.log(`changed uid:gid to ${ process.getuid() }:${ process.getgid() }`);
  }
}



