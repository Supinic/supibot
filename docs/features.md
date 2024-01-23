## Features
The full, dynamic command list can be found on [my website](https://supinic.com/bot/command/list).
It is also located as a list of directories and files in [this repository](https://github.com/Supinic/supibot/tree/master/commands).


Some of the features implemented commands provide include:
- setting an AFK status, and specifying a message when coming back
- reminders from user to user, timed reminders to others or yourself
- generating random lines in the scope of current channel, from a local database of chat lines
- opening and gifting a daily fortune cookie (resets daily on midnight UTC)
- various API commands, such as ones related to Twitch users' info, weather, time, cat/dog pictures, fun facts, and many more...
- *opting-out* of specific commands, which makes all users unable to use that command with that user's name as a parameter
- *blocking* specific people from specific commands, which makes specific users unable to use a specific command on that user
- *mention opt-out*, which makes a specific command or set of commands not *mention* that user
- a safe way to execute JavaScript code with the `$js` command
  - this also includes some utilities and access to limited amount of bot data (read-only)
- so-called *piping*, which is executed through the _pipe_ command
    - this allows to daisy-chain commands together, the first result being appended at the end of another command as extra arguments, and so on
    - example: `$pipe news DE | translate` will look up German news, and translate them to (default) English
    - example: `$pipe rw | urban | tt fancy` will generate a random word, search for its UrbanDictionary definition, and turn that into fancy text
- command *aliasing*, which allows users:
  - to rename existing commands to their own liking, but only for themselves
  - create predefined usages, e.g. automatically translating to a certain language instead of having to provide the language every time
  - make and maintain complex commands, using pipes, existing code, even $js to create proper, full-sized commands or even mini-games within the bot
- many more commands, some of which use a local database

Some of the features backend provides include:
- Extensive custom and API banphrase checking
  - Custom banphrases:
    - are all defined in the database as code (`chat_data.Banphrase`) and are parsed to code form on startup (`sb.Banphrase`, [banphrase.js - class Banphrase](/custom_modules/supinic-globals/classes/banphrase.js))
    - can be specific to channel, platform, or be global
    - can set to replace specific words, entire messages, or make the bot not reply at all
    - can be linked to API banphrases, in order to reply with a custom message (e.g. an API banphrase that rejects non-ASCII characters will not make the bot output a non-user friendly message, but rather something like "No special characters allowed!")
    - if multiple exist for the same global/platform/channel context, then they are executed in a loop, ordered by Priority descending - if these are equal, then the banphrase ID is used instead
  - API banphrases:
    - are specific to certain channel
    - currently only supports [Pajbot's](https://github.com/pajbot/pajbot) (and its forks') API banphrases
    - for a closer look, inspect [banphrase.js - class ExternalBanphraseAPI](/custom_modules/supinic-globals/classes/banphrase.js)
  - Since banphrases are all code-based and asynchronous by default, it is trivial to to create rather advanced "banphrase modules" that work with the messages in a way string-replacements or regular expressions could not achieve. Examples:
    - *Anti-ping* - Replies with "That message pings too many users" if a message contains more than X amount of unique users that the bot has in its database of users
    - *Celsius module* - Searches for all instances of a Fahrenheit temperature and appends a Celsius equivalent
- So-called *mirroring* of channel-to-channel 
  - This takes all messages from one channel and re-sends them in another, across platforms if necessary
  - Each channel can only have one mirror set up, in order to avoid exponential increase of messages sent.
  - e.g. a simple mirror `1-to-1` sends one message per channel for a total of two, but a `1-to-1-to-1` mirror sends two messages per channel for a total of six, scaling `n*(n-1)` for `n` channels connected in this way, which is `O(n^2)`)
  - Therefore, it is a design choice to keep the relationships limited to these practical cases:
    - `1-to-1` (channels are mirrored together)
    - `1-to-N` (channels are funneled to one aggregate channel) - This does not violate the exponential growth of messages, as an aggregate channel has its own mirror output disabled. Also, such a relationship does not yet exist in practice.
  - a classic example of this usage is mirroring a Twitch channel with the community's Discord, in a specified "mirror" channel
  - for more info, see the [Controller template](https://github.com/Supinic/supibot/blob/master/controllers/template.js), method `mirror`
