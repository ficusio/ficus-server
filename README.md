Node.js backend for Feynman/Ficus project.
==============================================

Source ES6 code is transformed into ES5 with [6to5](https://github.com/6to5/6to5).
Uses [SockJS](https://github.com/sockjs/sockjs-node) for WebSocket protocol implementation.

Currently this is an early prototype, so don't expect it to be hugely useful :)

Installation and running
----------------------------------------------

```bash
$ mkdir feynman && cd feynman
# clone all components
$ git clone https://github.com/codehipsters/feynman-server.git server
$ git clone https://github.com/codehipsters/feynman-presenter.git presenter
$ git clone https://github.com/codehipsters/feynman-listener.git listener
# build presenter and listener
$ cd presenter && npm install && bower install && brunch build --production && cd ..
$ cd listener && npm install && bower install && brunch build --production && cd ..
# copy static files to server
$ rm -rf server/public/* && cp -Rf presenter/public/. listener/public/. server/public/
# configure server
$ cd server
$ npm install
$ vi config.dev.json # configure host, port, hostname and Twitter credentials
# start server
$ npm start
```

Usage of the prototype
----------------------------------------------

1. Register new session and become it's presenter (`$id` is a unique name if this session): `http://$hostname/register-presentation/$id`;
2. open presenter interface `http://$hostname/presenter`;
3. invide audience to open listener interface `http://$hostname`.
