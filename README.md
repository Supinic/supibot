# Supibot
Main repository for the multi-platform chat bot Supibot.

## Usage
Supibot is not (yet) designed to be run as separate instances! Any changes to the code are welcome, but the bot was never designed to be run separately from its master instance. As such, all code changes will be reviewed on the master instance. I understand that this is not ideal for feature implementation, and separate instances will hopefully be supported soon.

## Platforms
Supibot can and is currently run on four distinct platforms, each with a specific client file, located in `/clients/`.
- Twitch
- Discord
- Cytube
- Mixer

Each client must implement basic methods of communication, regardless of the platform used. These include:
- `send` to send messages to a specific channel
- `pm` to send private messages, if platform supports it (in the other case, make sure to set a flag)
- `mirror` to mirror messages into a different channel

## Features
The full command list can be found [here](https://supinic.com/bot/command/list). 
If you are interested in the code of each command, the link can be found in each command's detail page.
Some of the features implemented commands provide include:
- setting an AFK status, and specifying a message when coming back
- reminders from user to user, timed reminders to others or yourself
- generating random lines in the scope of current channel, from a local database of chat lines
- opening and gifting a daily fortune cookie (resets daily on midnight UTC)
- various API commands, such as ones related to stream info, weather, time, cat/dog pictures, fun facts, and many more...
- many more commands, some of which use a local database

Some of the features backend provides include:
- Extensive custom and API banphrase checking
  - Custom banphrases:
    - are all defined in the database as code (`chat_data.Banphrase`) and are parsed to code form on startup (`sb.Banphrase`, [banphase.js - class Banphrase](/custom_modules/supinic-globals/classes/banphrase.js))
    - can be specific to channel, platform, or be global
    - can set to replace specific words, entire messages, or make the bot not reply at all
    - can be linked to API banphrases, in order to reply with a custom message (e.g. an API banphrase that rejects non-ASCII characters will not make the bot output a non-user friendly message, but rather something like "No special characters allowed!")
    - if multiple exist for the same global/platform/channel context, then they are executed in a loop, ordered by Priority descending - if these are equal, then the banphrase ID is used instead
  - API banphrases:
    - are specific to certain channel
    - currently only supports [Pajbot's](https://github.com/pajbot/pajbot) (and its forks') API banphrases
    - for a closer look, inspect [banphrase.js - class ExternalBanphraseAPI](/custom_modules/supinic-globals/classes/banphrase.js)
  - Since banphrases are all code-based and asynchronous by default, it is trivial to to create rather advanced "banphrase modules" that work with the messages in a way string-replacements or regular expressions could not achieve. Examples:
    - "Anti-ping" - Replies with "That message pings too many users" if a message contains more than X amount of unique users that the bot has in its database of users
    - "Celsius module" - Searches for all instances of a Fahrenheit temperature and appends a Celsius equivalent

- So-called `mirroring` of channel-to-channel (see `/master.js` and `/clients/<client>.js`, methods `mirror`)
  - This takes all messages from one channel and re-sends them in another, across platforms if necessary
  - Each channel can only have one mirror set up, in order to avoid exponential increase of messages sent (e.g. a `1-to-1` mirror sends one message per channel for a total of two, but a `2-to-2` mirror sends two messages per channel for a total of four, scaling `O(n^2)`)
  - This practically means that a mirror relationship can be:
    - `1-to-1` (channels are mirrored together)
    - `1-to-N` (channels are funneled to one aggregate channel) - This does not violate the exponential growth of messages, as an aggregate channel has its own mirror output disabled. Also, such a relationship does not yet exist in practice.  
- 
