module.exports = {
  message:
  {
    // messages from both presenter and listeners
    inp_init: 'init',
    // messages from presenter
    inp_pres_start: 'start',
    inp_pres_finish: 'finish',
    inp_pres_slide: 'slide',
    inp_pres_poll_start: 'poll_start',
    inp_pres_poll_finish: 'poll_finish',
    // messages from listeners
    inp_list_vote_up: 'vote_up',
    inp_list_vote_down: 'vote_down',
    inp_list_question: 'question',
    inp_list_poll_vote: 'poll_vote',

    // messages to both presenter and listeners
    out_initial_state: 'initial_state',
    out_presentation_state: 'presentation_state',
    out_poll: 'poll',
    // messages to presenter
    out_pres_total_listeners: 'total',
    out_pres_audience_mood: 'mood',
    out_pres_question: 'question'
  },
  presentation_state:
  {
    not_started: 'not_started',
    active: 'active',
    ended: 'ended'
  },
  code:
  {
    internal_server_error: 'internal_server_error',
    malformed_message: 'malformed_message',
    presentation_not_found: 'presentation_not_found',
    unauthorized: 'unauthorized'
  }
};
