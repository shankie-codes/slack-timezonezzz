'use strict'

const express = require('express');
const Slapp = require('slapp');
const ConvoStore = require('slapp-convo-beepboop');
const Context = require('slapp-context-beepboop');
const chrono = require('chrono-node');
const request = require('superagent');
const _ = require('lodash');

// use `PORT` env var on Beep Boop - default to 3000 locally
var port = process.env.PORT || 3000;

var slapp = Slapp({
  // Beep Boop sets the SLACK_VERIFY_TOKEN env var
  verify_token: process.env.SLACK_VERIFY_TOKEN,
  convo_store: ConvoStore(),
  context: Context()
});


var HELP_TEXT = `
I will respond to the following messages:
\`help\` - to see this message.
\`hi\` - to demonstrate a conversation that tracks state.
\`thanks\` - to demonstrate a simple response.
\`<type-any-other-text>\` - to demonstrate a random emoticon response, some of the time :wink:.
\`attachment\` - to see a Slack attachment message.
`

//*********************************************
// Setup different handlers for messages
//*********************************************

// response to the user typing "help"
slapp.message('help', ['mention', 'direct_message'], (msg) => {
  msg.say(HELP_TEXT)
})

// Listen for times
slapp
  .message('^.*', ['direct_mention', 'direct_message'], (msg, text) => {

    // Get the timezeones that are in use
    request
      .get(`https://slack.com/api/users.list?token=${msg.meta.bot_token}`)
      .end(function(err, res){
        if (err){
          return err;
        }
        else{
          //We got the users list
          //Compose an array of timezones based on the tz prop of all real users
          let timezones = res.body.members.map((member) => {
            if (!member.is_bot) {
              return ({
                tz: member.tz,
                tz_offset: member.tz_offset,
              });
            }
          })
          timezones = timezones.filter((timezone) => timezone != {} && timezone != null);
          timezones = _.uniqBy(timezones, 'tz');
          msg.say(`\`\`\`${JSON.stringify(timezones, null, 2)}\`\`\``);
        }
      });


    // msg
    //   .say(`Right back atchya ${text}`)
      // .say(`Date at: ${chrono.parse(text)[0].start.date()}`)
      // console.log(`Date at: ${chrono.parseDate('12:30pm')}`);
      // console.log(chrono.parse(text));
      // console.log(msg.meta.bot_token);
      // console.log(text);
      // console.log(chrono.parseDate(msg.body.event.text));
      // sends next event from user to this route, passing along state
      // .route('how-are-you', { greeting: text })
  })

// demonstrate returning an attachment...
slapp.message('attachment', ['mention', 'direct_message'], (msg) => {
  msg.say({
    text: 'Check out this amazing attachment! :confetti_ball: ',
    attachments: [{
      text: 'Slapp is a robust open source library that sits on top of the Slack APIs',
      title: 'Slapp Library - Open Source',
      image_url: 'https://storage.googleapis.com/beepboophq/_assets/bot-1.22f6fb.png',
      title_link: 'https://beepboophq.com/',
      color: '#7CD197'
    }]
  })
})

// Catch-all for any other responses not handled above
slapp.message('.*', ['direct_mention', 'direct_message'], (msg) => {
  // respond only 40% of the time
  if (Math.random() < 0.4) {
    msg.say([':wave:', ':pray:', ':raised_hands:'])
  }
})

// attach Slapp to express server
var server = slapp.attachToExpress(express())

// start http server
server.listen(port, (err) => {
  if (err) {
    return console.error(err)
  }

  console.log(`Listening on port ${port}`)
})
