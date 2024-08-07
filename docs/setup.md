# Setup

## Docker 

The easiest way to get started is to use a `docker-compose` file, which includes all the needed services:
```yaml
name: "supibot"
services:
    db:
      image: mariadb:11.4
      restart: unless-stopped
      volumes:
        - <path_to_store_db>:/var/lib/mysql
        - type: bind
          source: ./db-init.sql
          target: /docker-entrypoint-initdb.d/db-init.sql
      environment:
        - MARIADB_RANDOM_ROOT_PASSWORD=1
        - MARIADB_PASSWORD=supibot
        - MARIADB_USER=supibot
    redis:
      image: redis
      restart: unless-stopped
    supibot:
      build: .
      links:
        - db
        - redis
      volumes:
        - type: bind
          source: <path_to_supibot_repository>/config.json
          target: /home/supibot/config.json
      restart: unless-stopped
      environment:
        - "MARIA_HOST=db"
        - "MARIA_USER=supibot"
        - "MARIA_PASSWORD=supibot"
        - "REDIS_CONFIGURATION=redis"
        - "COMMAND_PREFIX=<command_prefix>"
        - "INITIAL_BOT_NAME=<bot_name>"
        - "INITIAL_PLATFORM=twitch"
        #- "INITIAL_PLATFORM=discord"
        - "INITIAL_CHANNEL=<initial_channel>"
        - "TWITCH_CLIENT_ID=<your_client_id>"
        - "TWITCH_CLIENT_SECRET=<your_client_secret>"
        - "TWITCH_REFRESH_TOKEN=<your_refresh_token>"
        #- "DISCORD_BOT_TOKEN=<your_discord_token>"
        - "SUPIBOT_API_PORT=<preferred_api_port>"
```

- Note: The database docker image currently doesn't accept any database usernames other than `supibot`.

To start off:
1) Copy `config-default.json` as `config.json`, and fill out your custom configuration - especially regarding desired platforms
2) In the compose file, configure:
   1) Path to the database service (`<path_to_store_db>`)
   2) Bot environment values, and the authentication info as needed (see below for specific platform info)
   3) Absolute path to the freshly created `./config.json` file (`<path_to_supibot_repository>`)
3) Run Docker

### Authentication

For Twitch:

1. Create an application: [guide on Twitch](https://dev.twitch.tv/docs/authentication/register-app/)
2. Note your `Client ID` and `Client secret` tokens
3. Visit [this website](https://twitchtokengenerator.com/) for token generation, pick "Custom Scope Token"
5. Fill in the section `Use My Client Secret and Client ID` with the tokens from step 2
6. Allow token scopes: 
   - `user:bot` `user:read:chat` `user:write:chat` to read and send messages (**required**)
   - `user:read:emotes` to fetch the bot's own emotes (**suggested**)
   - `user:manage:whispers` for whispers (private messages) functionality (**suggested**)
   - `channel:moderate` for moderation actions (**optional**)
7. Fill in the environmental values in the compose file accordingly
   - `TWITCH_CLIENT_ID`
   - `TWITCH_CLIENT_SECRET`
   - `TWITCH_REFRESH_TOKEN`

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
4) Copy `db-access.js.example` as `db-access.js` (do **not** commit this file)
5) Fill in your `MariaDB` credentials to `db-access.js`, using sockets or hosts respectively
6) Run `yarn install`
7) Run `yarn run init-database`
8) Run `yarn start` to verify that the bot can start up correctly. If it does, it will not attempt to join any platforms or channels. In order to do so, continue:
9) Fill in authentication token(s) in `data.Config`, depending on which platform to join - by editing its `Value` from `NULL` to given token
10) Copy `config-default.json` as `config.json` and fill out your custom configuration, especially regarding desired platforms
11) Set up at least one channel per platform to `chat_data.Channel` table, by inserting a new row, and filling the channel's `Name`, `Specific_ID` and `Platform`
12) Edit `COMMAND_PREFIX` in `data.Config` for your preferred command prefix
13) Run the bot as in **7)**, or `yarn run debug` for debug access

#### Adjustments

In order to set yourself as the `administrator` of Supibot:

1) Make sure you have been seen by the bot - check the `chat_data.User_Alias` table, find your name, and note the user ID
2) Create a new row in the `chat_data.User_Alias_Data` table: 
  - `User_Alias` is the ID you noted
  - `Property` is `administrator`
  - `Value` is `true`
3) Changes should apply immediately, in case they don't, restart the bot
