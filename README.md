Node.js backend for Feynman/Ficus project.

Source ES6 code is transformed into ES5 using [6to5](https://github.com/6to5/6to5).
Uses [SockJS](https://github.com/sockjs/sockjs-node) for WebSocket protocol implementation.

Currently this is an early prototype, so don't expect it to be hugely useful :)

Running in dev mode:

```bash
$ git clone https://github.com/codehipsters/feynman-server.git
$ cd feynman-server
$ npm install
$ vi config.dev.json # set hostname, port and Twitter settings
$ mkdir public
# clone feynman-presenter and feynman-listener, build them and copy
# contents of feynman-presenter/public and feynman-listener/public
# into feynman-server/public
$ npm start
```

Note: at the moment `npm install` fails because of [this issue in 6to5](https://github.com/6to5/6to5/issues/137).
Hopefully it will be resolved soon.

HTTP interface:
* `/register-presentation/$id`: register a new presentation with id `$id` and become a presenter for this presentation;
* `/presenter`: presenter interface;
* `/`: listener interface.
