var debug = require('debug')('app:store'),
    P = require('./ws-protocol');


function stringify(obj)
{
  return JSON.stringify(obj, null, '  ');
}


class Presentation
{
  
  constructor (id)
  {
    this.id = id;
    this.state = P.presentation_state.not_started;
    this.totalClients = 0;
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
    this.state = P.presentation_state.active;
    this.debug('started');
  }


  finish ()
  {
    this.state = P.presentation_state.ended;
    this.debug('finished');
  }


  setSlideId (slideId)
  {
    this.slideId = slideId;
    this.debug('slide id set:', id);
  }


  startPollAndGetEmptyResults (poll)
  {
    if (this.pollsById[ poll.id ])
    {
      return this.debug('poll was already started');
    }
    var pollWithResults = {
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

  }


  voteDown (clientId)
  {

  }


  answerPollAndGetResults (clientId, optionIndex)
  {
    var pollWithResults = this.poll;
    if (pollWithResults == null)
    {
      return debug('answerPollAndGetResults: no active poll');
    }

    var { poll, results } = pollWithResults;
    var totalOptions = results.length;

    debug('results', results, 'totalOptions', totalOptions);

    if (optionIndex >= totalOptions)
    {
      return debug('answerPollAndGetResults: invalid index');
    }

    var client = this.clientsById[ clientId ];
    if (client == null)
    {
      return debug(`answerPollAndGetResults: client with id ${ clientId } not found`);
    }

    var prevOptionIndex = client.votesByPollId[ poll.id ];
    debug('prevOptionIndex', prevOptionIndex);
    if (prevOptionIndex == optionIndex)
    {
      return debug('answerPollAndGetResults: vote is not changed');
    }

    client.votesByPollId[ poll.id ] = optionIndex;

    if (prevOptionIndex >= 0)
    {
      --results[ prevOptionIndex ].count;
    }
    ++results[ optionIndex ].count;

    debug('now results', results);

    var totalVoters = 0,
        i;

    for (i = 0; i < totalOptions; ++i)
    {
      totalVoters += results[i].count;
    }

    var normCoeff = (totalVoters == 0) ? 0 : 1 / totalVoters;

    debug('totalVoters', totalVoters, 'normCoeff', normCoeff);

    for (i = 0; i < totalOptions; ++i)
    {
      var result = results[i];
      result.weight = result.count * normCoeff;
      debug('  results[' + i + ']:', result);
    }

    debug('new poll vote, now results:', stringify(results));

    return results;
  }

}


function createNewClientWithId (clientId)
{
  return {
    id: clientId,
    active: true,
    votesByPollId: {}
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
