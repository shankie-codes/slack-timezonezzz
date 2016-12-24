'use strict'

const express = require('express');
const Slapp = require('slapp');
const ConvoStore = require('slapp-convo-beepboop');
const Context = require('slapp-context-beepboop');
const chrono = require('chrono-node');
const request = require('superagent');
const _ = require('lodash');
const moment = require('moment');

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

const getEmojiFromTime = function(time) {
  let hour = moment(time).format('h');
  hour = hour == 0 ? 12 : hour;
  return `:clock${hour}:`;
}

//*********************************************
// Setup different handlers for messages
//*********************************************

// response to the user typing "help"
slapp.message('help', ['mention', 'direct_message'], (msg) => {
  msg.say(HELP_TEXT)
})

// Listen for times
slapp
  .message('^.*', ['mention', 'direct_mention', 'direct_message'], (msg, text) => {
    let parsedDate = chrono.parseDate(text);
    if(parsedDate){
      // Get the Unix time and convert to seconds
      let parsedTime = parsedDate.getTime() / 1000;

      console.log(msg.body.event);
      
      // Get the users in this channel
      request
      .get(`https://slack.com/api/channels.info?channel=${msg.body.event.channel_id}&token=${msg.meta.bot_token}`)
      .end((err, res) =>{
        const usersInChannel = res.channel.members;
        console.log(usersInChannel)
        // Get the timezeones that are in use in this channel
        request
        .get(`https://slack.com/api/users.list?token=${msg.meta.bot_token}`)
        .end(function(err, res){
          if (err){
            return err;
          }
          else{
            //We got the users list
            //Compose an array of timezones based on the tz prop of all real users
            let timezones = res.body.members
              .filter((member) => !member.is_bot && usersInChannel.indexOf(member.id) >= 0 && member.tz)
              .map((member) => {
                return ({
                  tz: member.tz,
                  tz_offset: member.tz_offset,
                  tz_label: member.tz_label,
                  offset_timestamp: parsedTime + member.tz_offset,
                  offset_time: moment((parsedTime + member.tz_offset)*1000).format('HH:mm'),
                  offset_date: moment((parsedTime + member.tz_offset)*1000).format('dddd D MMM'),
                  emoji: getEmojiFromTime((parsedTime + member.tz_offset)*1000)
              });
            })

            // Get unique entries
            timezones = _.uniqBy(timezones, 'tz');

            // Compose a string
            let message = "";
            timezones.forEach((timezone) => {
              message += `${timezone.emoji} *${timezone.offset_time}* on ${timezone.offset_date} \`${timezone.tz_label}\`\n`;
            });

            msg.say(message);
          }
        });
      });
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
