var { EventEmitter } = require('events');

var twitter = require('ntwitter'),
    debug = require('debug')('app:twitter');

class TwitterWatcher extends EventEmitter
{
  constructor (options)
  {
    debug('new TwitterWatcher: ' + JSON.stringify(options, null, '  '));

    this.twitter = new twitter({
      consumer_key: options.consumer_key,
      consumer_secret: options.consumer_secret,
      access_token_key: options.access_token_key,
      access_token_secret: options.access_token_secret
    });

    this.watchTags = options.watchTags;
  }


  stopWatch ()
  {
    try
    {
      this.stream && this.stream.destroy();
    }
    catch (e) {}
  }


  startWatch ()
  {
    this.twitter.stream('statuses/filter', { track: this.watchTags },
      (stream) => this._onTwitterStream(stream)
    );
  }


  _onTwitterStream (stream)
  {
    this.stream = stream;
    stream.on('data', (tweet) => this._onData(tweet));
    stream.on('error', (err) => debug('twitter error:', (err && err.stack) || err));
  }


  _onData (tweet)
  {
    if (tweet.text !== undefined)
    {
      this.emit(TwitterWatcher.NEW_TWEET, {
        text: tweet.text,
        user: tweet.user.screen_name
      });
    }
  }
}


TwitterWatcher.NEW_TWEET = 'new_tweet';


module.exports = TwitterWatcher;
