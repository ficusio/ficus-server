var debug = require('debug')('app:store'),
    P = require('./ws-protocol');


function stringify(obj)
{
  return JSON.stringify(obj, null, '  ');
}


var MOOD_EXPIRY_TIME = 15000;


class Presentation
{
  
  constructor (id)
  {
    this.id = id;
    this.state = P.presentation_state.not_started;
    this.totalClients = 0;
    this.meanMood = 0;
    this.clientsById = {};
    this.presenterId = null;
    this.messages = [];
    this.slideId = null;
    this.polls = [];
    this.pollsById = {};
    this.poll = null;
    this.debug = require('debug')(`app:store:Presentation<${ id }>`);
  }


  setPresenterId (id)
  {
    this.presenterId = id;
    this.debug('presenter id set:', id);
  }


  start ()
  {
    if (this.state != P.presentation_state.not_started)
    {
      debug('start: invalid current state ' + this.state);
      return false;
    }
    this.state = P.presentation_state.active;
    this.debug('started');
    return true;
  }


  finish ()
  {
    if (this.state != P.presentation_state.active)
    {
      debug('finish: invalid current state ' + this.state);
      return false;
    }
    this.state = P.presentation_state.ended;
    this.debug('finished');
    return true;
  }


  setSlideId (slideId)
  {
    this.slideId = slideId;
    this.debug('slide id set:', id);
  }


  startPollAndGetCurrentResults (poll)
  {
    var pollWithResults = this.pollsById[ poll.id ];
    if (pollWithResults)
    {
      this.debug('poll was already started');
      return pollWithResults.results;
    }
    pollWithResults = {
      poll: poll,
      results: emptyPollResultsForPoll(poll)
    };
    this.polls.push(pollWithResults);
    this.pollsById[ poll.id ] = pollWithResults;
    this.poll = pollWithResults;
    this.debug('poll started:', stringify(this.poll));
    return pollWithResults.results;
  }


  stopPoll ()
  {
    this.poll = null;
    this.debug('poll stopped');
  }


  addMessage (message)
  {
    this.messages.push(message);
    this.debug('message added:', stringify(message));
  }


  getClientById (clientId)
  {
    return this.clientsById[ clientId ];
  }


  addNewClientAndGetTotal (clientId)
  {
    var client = this.clientsById[ clientId ];
    if (client == null)
    {
      this.clientsById[ clientId ] = createNewClientWithId(clientId);
      ++this.totalClients;
      this.debug(`new client added: ${ clientId }, now total ${ this.totalClients }`);
    }
    else if (!client.active)
    {
      client.active = true;
      ++this.totalClients;
      this.debug(`client ${ clientId } re-activated, now total ${ this.totalClients }`);
    }
    else {
      this.debug(`client ${ clientId } already active, total ${ this.totalClients } remained`);
    }
    return this.totalClients;
  }


  markClientAbsentAndGetTotal (clientId)
  {
    var client = this.clientsById[ clientId ];
    if (client == null)
    {
      this.debug(`markClientAbsentAndGetTotal: client ${ clientId } is not in the list`);
    }
    else if (client.active)
    {
      client.active = false;
      --this.totalClients;
      this.debug(`client ${ clientId } de-activated, now total ${ this.totalClients }`);
    }
    else {
      this.debug(`client ${ clientId } is already inactive, total ${ this.totalClients } remained`);
    }
    return this.totalClients;
  }


  voteUp (clientId)
  {
    this._vote(clientId, +1);
  }


  voteDown (clientId)
  {
    this._vote(clientId, -1);
  }


  _vote (clientId, sign)
  {
    var client = this.clientsById[ clientId ];
    if (client == null)
    {
      return this.debug(`vote ${ clientId }: client not found`);
    }
    var time = Date.now();
    client.moodVotes.push({ time, sign });
    this.debug(`client ${ clientId } new mood vote:`, { time, sign });
  }


  updateMood ()
  {
    var timeNow = Date.now(),
        clientsById = this.clientsById,
        totalClients = 0,
        meanMood = 0;

    for (var clientId in clientsById)
    {
      var client = clientsById[ clientId ],
          moodVotes = client.moodVotes,
          totalVotes = moodVotes.length,
          expiredVotes = 0,
          lastChangeIndex = -1,
          lastChangeSign = 0,
          clientMood = 0;

      for (var i = 0; i < totalVotes; ++i)
      {
        var { time, sign } = moodVotes[i];
        var timePassed = timeNow - time;
        
        if (timePassed > MOOD_EXPIRY_TIME)
        {
          ++expiredVotes;
        }
        else if (sign != lastChangeSign)
        {
          lastChangeSign = sign;
          lastChangeIndex = i;
        }
      }

      if (expiredVotes > 0)
        moodVotes.splice(0, expiredVotes);

      clientMood = (lastChangeSign == 0)
        ? 0
        : lastChangeSign * Math.min(1, Math.max(0, 1 - timePassed / MOOD_EXPIRY_TIME))

      meanMood += clientMood;
      ++totalClients;
    }

    if (totalClients > 0)
      meanMood /= totalClients;

    this.meanMood = meanMood;
    return meanMood;
  }


  answerPollAndGetResults (clientId, optionIndex)
  {
    var pollWithResults = this.poll;
    if (pollWithResults == null)
    {
      return this.debug('answerPollAndGetResults: no active poll');
    }

    var { poll, results } = pollWithResults;
    var totalOptions = results.length;

    this.debug('results', results, 'totalOptions', totalOptions);

    if (optionIndex >= totalOptions)
    {
      return this.debug('answerPollAndGetResults: invalid index');
    }

    var client = this.clientsById[ clientId ];
    if (client == null)
      return this.debug(`answerPollAndGetResults: client with id ${ clientId } not found`);

    var prevOptionIndex = client.votesByPollId[ poll.id ];
    if (prevOptionIndex == optionIndex)
      return this.debug('answerPollAndGetResults: vote is not changed');

    client.votesByPollId[ poll.id ] = optionIndex;

    if (prevOptionIndex >= 0)
      --results[ prevOptionIndex ].count;
    ++results[ optionIndex ].count;

    var totalVoters = 0,
        i;

    for (i = 0; i < totalOptions; ++i)
      totalVoters += results[i].count;

    var normCoeff = (totalVoters == 0) ? 0 : 1 / totalVoters;

    for (i = 0; i < totalOptions; ++i)
    {
      var result = results[i];
      result.weight = result.count * normCoeff;
    }

    return results;
  }

}


function createNewClientWithId (clientId)
{
  return {
    id: clientId,
    active: true,
    votesByPollId: {},
    moodVotes: []
  }
}


function emptyPollResultsForPoll(poll)
{
  return poll.options.map(function (opt) {
    return {
      label: opt.label,
      color: opt.color,
      count: 0,
      weight: 0
    };
  });
}

var db =
{
  presentationsById: {},
  activePresentation: null
};


function getPresentationById (id, activate = false)
{
  var presentation = db.presentationsById[ id ];
  if (activate)
  {
    if (presentation == null)
    {
      db.presentationsById[ id ] = presentation = new Presentation(id);
      debug('created new Presentation:', id);
    }
    db.activePresentation = presentation;
    debug('activated Presentation:', id);
  }
  return presentation;
}


function getActivePresentation ()
{
  return db.activePresentation;
}


module.exports = {
  getPresentationById,
  getActivePresentation
};
