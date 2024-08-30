# Supibot
Main repository for the multi-platform, novelty and utility chat bot Supibot.

## Platforms
Supibot can and is currently run on four distinct platforms:
- [Twitch](https://twitch.tv/)
- [Discord](https://discordapp.com/)
- [Cytube](https://cytu.be/)
- ~~Mixer~~ (until 2020-07-22)
- [~~Minecraft~~](https://www.minecraft.net/) (not currently active)
- [IRC](https://datatracker.ietf.org/doc/html/rfc1459)

## I want to use Supibot!
Pick your platform, and follow these steps: 

|      Platform      | Directions                                                                                                                                                                                                                      |
|:------------------:|:--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Twitch channel** | Fill out [this form](https://supinic.com/bot/request-bot/form).                                                                                                                                                                 |
| **Discord server** | The administrator of given server should [PM me on Discord](https://supinic.com/contact) - simply join my server and you can PM me immediately. Keep the [Discord-specific rules](https://i.imgur.com/ocqTmaF.png) in mind too! | 
|  **Cytube room**   | Fill out [this form](https://supinic.com/bot/request-bot/form).                                                                                                                                                                 |
|  **IRC channel**   | Currently only active on [Libera](https://libera.chat/). [Contact me](https://supinic.com/contact) for more info.                                                                                                               |

To contact me, see [Contact](https://supinic.com/contact) on my website.

## Running own instance
It's possible to host your own instance of supibot. You can either set it up as a node app manually, or use the docker image.

Follow [the guide](docs/setup.md) if you are interested, and contact me if you have any questions or notes.

Also check out the [modules configuration file](./config-default.json) for a brief guide on how to enable/disable a specific set of commands or other modules. 

## Ambassadors
Owners of channels (or Discord servers) have elevated rights to manage Supibot. 
They are allowed to e.g. disable specific commands, ban users from specific commands or ban them outright - all in the scope of their channel/server.

If the channel/server owner wishes to delegate this power to one or more users, they should:
- For Discord, either:
  - appoint the user as an administrator
  - create a role named "Supibot Ambassador" and assign the user to it
- For other platforms: create a suggestion (`$suggest` command) explaining that they wish to assign an ambassador(s) in a channel. Make sure to list their names and your channel's name

## DankChat integration
The [DankChat](https://github.com/flex3r/DankChat) mobile application for Twitch chat uses Supibot's API in order to hint its commands in any channel Supibot is actively in!
It's a wonderful app to use on the go, and I endorse it.

## Further reading
- [Bot feature overview](docs/features.md)
- [Command docs + how to make your own](docs/commands.md)
- [Website API with bot data](docs/api.md)
