
var debug = require('debug')('app:client-connection'),
    P = require('./ws-protocol'),
    initMessageType = P.message.inp_init;

var { EventEmitter } = require('events');


class ClientConnection extends EventEmitter
{

  static stringifyMessage (type, data)
  {
    try {
      return JSON.stringify({ type, data });
    } 
    catch (e) {
      console.error(`cannot stringify message ${ type }:"${ msg }": ${ e }`);
      return null;
    }
  }


  constructor (sockJsConn)
  {
    this.clientId = undefined;
    this.presentationId = undefined;
    this.isPresenter = undefined;
    this._sockJsConn = sockJsConn;
    this._sockJsConn.on('data', (str) => this._onData(str));
  }


  send (type, data)
  {
    var str = ClientConnection.stringifyMessage(type, data);
    str && this.write(str);
  }


  write (str)
  {
    //debug(`client ${ this.clientId } write: ${ str }`);
    this._sockJsConn && this._sockJsConn.write(str);
  }


  close (reason = P.code.internal_server_error)
  {
    if (this._sockJsConn)
    {
      this._sockJsConn.removeAllListeners();
      try
      {
        this._sockJsConn.close(1000, reason);
      }
      catch (e) {}
    }
    debug(`client ${ this.clientId } rejected with reason ${ reason }`);
  }


  _onData (str)
  {
    debug(`incoming message from client ${ this.clientId }:`, str);
    try
    {
      var msg = JSON.parse(str),
          data = msg.data;

      if (this.clientId == null)
      {
        if (msg.type != initMessageType)
          throw new Error('got data message before init');

        if (data == null || data.clientId == null || data.presentationId == null)
        {
          this.close(P.code.malformed_message);
          throw new Error('malformed init message');
        }

        debug(`got init message: client ${ data.clientId }, pres ${ data.presentationId }`);

        this.presentationId = data.presentationId;
        this.clientId = data.clientId;
        this.isPresenter = !!data.isPresenter;

        this._sockJsConn.on( 'close', () => this.emit('close', this) );

        return this.emit(initMessageType, this);
      }
      else if (msg.type == initMessageType)
      {
        throw new Error('duplicate init message');
      }

      this.emit(msg.type, this, msg.data);
    }
    catch (e) {
      console.warn(`error handling message "${ str }" from client ${ this.clientId }: ${ e }`);
      if (e && e.stack) console.log(e.stack);
    }
  }

}


module.exports = ClientConnection;
