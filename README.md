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
# configure server
$ cd server
$ npm install
$ vi config.dev.json # configure host, port, hostname and Twitter credentials
# build and copy static files for presenter and listener apps
$ ./build-static.sh
# start server
$ npm start
```

Usage of the prototype
----------------------------------------------

1. Register new session and become it's presenter: `http://$hostname/register-presentation/$id`;
   `$id` is an unique identifier of this session;
2. open presenter interface `http://$hostname/presenter`;
3. invite audience to open listener interface `http://$hostname/`.
