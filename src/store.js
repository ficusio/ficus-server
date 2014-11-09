var debug = require('debug')('app:store');


function stringify(obj)
{
  return JSON.stringify(obj, null, '  ');
}


class Presentation
{
  
  constructor (id)
  {
    this.id = id;
    this.started = false;
    this.finished = false;
    this.totalClients = 0;
    this.clientsById = {};
    this.presenterId = null;
    this.messages = [];
    this.slideId = null;
    this.polls = [];
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
    this.started = true;
  }


  setSlideId (slideId)
  {
    this.slideId = slideId;
    this.debug('slide id set:', id);
  }


  startPoll (poll)
  {
    var pollWithResults = {
      poll: poll,
      results: emptyPollResultsForPoll(poll)
    };
    this.polls.push(pollWithResults);
    this.poll = pollWithResults;
    this.debug('poll started:', stringify(this.poll));
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


  addNewClientAndGetTotal (clientId)
  {
    var client = this.clientsById[ clientId ];
    if (client == null)
    {
      this.clientsById[ clientId ] = { active: true };
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


  answerPollAndGetResults (client)
  {

  }


  finish ()
  {
    this.finished = true;
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
