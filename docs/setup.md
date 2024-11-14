# Setup

## Docker 

The easiest way to get started is to use a `docker-compose` file, which includes all the needed services.

To start off:
1) Copy `config-default.json` as `config.json`
2) In the config file, configure:
   - Your desired platform(s)
   - Anything regarding bot behaviour: commands, chat modules, logging, ... 
3) Copy `docker-compose.example.yaml` as `docker-compose.yaml`
4) In the compose file, set up:
   - Bot environment values, and the authentication info as needed (see below for specific platforms)
   - Absolute path to the freshly created `./config.json` file (`<path_to_supibot_repository>`)
   - Uncomment the `DEBUG_MODE` environment value for debugging 
5) Run Docker: `docker compose up`
6) For debugging:
   1) In your host machine's browser, navigate to `chrome://inspect`
   2) Add `localhost:9229`
   3) Open the console via `Remote Target → inspect`

### Authentication guides

#### Twitch

1. Create an application: [guide on Twitch](https://dev.twitch.tv/docs/authentication/register-app/)
2. Note your `Client ID` and `Client secret` tokens
3. Visit [this website](https://twitchtokengenerator.com/) for token generation, pick "Custom Scope Token"
4. Fill in the section `Use My Client Secret and Client ID` with the tokens from step 2
5. Allow token scopes: 
   - `user:bot` `user:read:chat` `user:write:chat` to read and send messages (**required**)
   - `user:read:emotes` to fetch the bot's own emotes (**suggested**)
   - `user:manage:whispers` for whispers (private messages) functionality (**suggested**)
   - `channel:moderate` for moderation actions (**optional**)
6. Generate the token, allow the Twitch authorization (make sure the account being authorized is your bot account!) and note the token
7. Fill in the env values in the compose file accordingly:
   - `TWITCH_CLIENT_ID`
   - `TWITCH_CLIENT_SECRET`
   - `TWITCH_REFRESH_TOKEN`

#### Discord

1. Create an application: [Discord Developer Portal](https://discord.com/developers/applications)
2. Navigate to `Application → Bot`
3. Note the `Token` (will only be available to copy once) and `Application ID`
4. Set up the `Privileged Gateway Intents`: `Server members` and `Message content`
5. Fill in the `Application ID` into your `config.json`'s discord platform, as the `selfId` property
6. Fill in the env values in the compose file with your `Token`:
   - `DISCORD_BOT_TOKEN`

## CLI

Setting Supibot up locally requires several steps, and is much easier if done with an interactive script.

### Interactive script

1) Set up `MariaDB` of at least version `10.2.0` and credentials. Ideally, create a user separate for Supibot that has permissions on `data` and `chat_data` databases.
2) Set up `Redis`
3) `git clone` or `fork` the repository
4) Run `yarn install`, depending on which package manager you use
5) Run `yarn run setup` and walk through the interactive setup script, making sure to set up at least one platform, one channel and the command prefix
6) Run `yarn start`, or `yarn debug` for debug access

### Manual

Alternatively, if `run setup` does not work or for whatever other reason, follow this manual setup:

#### Groundwork

1) Set up `MariaDB` of at least version `10.2.0` + credentials
2) Set up `Redis`
3) `git clone` or `fork` the repository
4) Copy `.example.env` as `.env` and fill out all relevant env variables, including authentication credentials
5) Run `yarn install`
6) Run `yarn run init-database`
7) Run `yarn start` to verify that the bot can start up correctly. If it does, it will not attempt to join any platforms or channels. In order to do so, continue:
8) Copy `config-default.json` as `config.json` and fill out your custom configuration, especially regarding desired platforms
9) Set up at least one channel per platform to `chat_data.Channel` table, by inserting a new row, and filling the channel's `Name`, `Specific_ID` and `Platform`
10) Run the bot as in **7)**, or `yarn run debug` for debug access

#### Adjustments

In order to set yourself as the `administrator` of Supibot:

1) Make sure you have been seen by the bot - check the `chat_data.User_Alias` table, find your name, and note the user ID
2) Create a new row in the `chat_data.User_Alias_Data` table: 
  - `User_Alias` is the ID you noted
  - `Property` is `administrator`
  - `Value` is `true`
3) Changes should apply immediately, in case they don't, restart the bot
