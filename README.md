# Supibot
Main repository for the multi-platform, novelty and utility chat bot Supibot.

## Usage
Supibot is not (yet) designed to be run as separate instances! Any changes to the code are welcome, but the bot was never designed to be run separately from its master instance. As such, all code changes will be reviewed on the master instance. I understand that this is not ideal for feature implementation, and separate instances will hopefully be supported soon.

## Platforms
Supibot can and is currently run on four distinct platforms, each with its own client file.
- [Twitch](clients/twitch.js)
- [Discord](clients/discord.js)
- [Cytube](clients/cytube.js)
- [Mixer](clients/mixer.js)

## I want to use Supibot!
As Supibot is currently run as a single instance that joins multiple channel, it is required to follow one of these steps: 

| Platform | Directions |
| ------------- |:-------------:|
| **Twitch channel** | Follow the guide in the panels of the bot's [Twitch profile](https://twitch.tv/supibot). |
| **Discord server** | The admin of said server contact should PM me on Discord. See [Contact](https://supinic.com/contact). | 
| **Cytube room**    | Not currently implemented. Please contact me for implementation details. |
| **Mixer channel**  | Follow the guide in the description of the bot's [Mixer profile](https://mixer.com/supibot). |

## Further reading
- [API](docs/api.md)
- [Feature overview](docs/features.md)