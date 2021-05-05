# Setup

### Docker 

The easiest way to get started is to use a docker-compose file, which includes all the needed services:
```
version: "3"

services:
    db:
      image: supinic/supidb
      restart: unless-stopped
      volumes:
        - <path_to_store_db>:/var/lib/mysql
      environment:
        - MYSQL_RANDOM_ROOT_PASSWORD=1
        - MYSQL_PASSWORD=supibot
        - MYSQL_USER=supibot
    redis:
      image: redis
      restart: unless-stopped
    supibot:
      links:
        - db
        - redis
      image: supinic/supibot
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
        #- "DISCORD_BOT_TOKEN=<discord_token>"
        - "TWITCH_OAUTH=<your_oauth>"
```

Customize values such as `INITIAL_CHANNEL`, `COMMAND_PREFIX` and the authentication info as needed. You can use [this tool](https://twitchapps.com/tmi/) to get oauth keys for Twitch. Note: the database docker image currently doesn't accept any user names other than `supibot`.

### Manual

Setting Supibot up locally requires several steps, and is much easier if done with an interactive script.

#### Interactive

1) Set up `MariaDB` of at least version `10.2.0` and credentials. Ideally, create a user separate for Supibot that has permissions on `data` and `chat_data` databases.
2) Set up `Redis`
3) `git clone` or `fork` the repository
4) Run `npm/yarn install`, depending on which package manager you use
5) Run `npm/yarn run setup` and walk through the interactive setup script, making sure to set up at least one platform, one channel and the command prefix
6) Run `npm/yarn start`, or `npm run debug / yarn debug` for debug access

#### Manual

Alternatively, if `run setup` does not work or for whatever other reason, follow this manual setup:

1) Set up `MariaDB` of at least version `10.2.0` + credentials
2) Set up `Redis`
3) `git clone` or `fork` the repository
4) Copy `db-access.js.example` as `db-access.js` (do **not** commit this file)
5) Fill in your `MariaDB` credentials to `db-access.js`, using sockets or hosts respectively
6) Run `npm/yarn install`
7) Run `npm/yarn run init-database`
8) Run `npm/yarn start` to verify that the bot can start up correctly. If it does, it will not attempt to join any platforms or channels. In order to do so, continue:
9) Fill in authentication token(s) in `data.Config`, depending on which platform to join - by editing its `Value` from `NULL` to given token
10) For each platform to join, edit its `chat_data.Platform` row and set up Supibot's account name `Self_Name`
11) Set up at least one channel per platform to `chat_data.Channel` table, by inserting a new row, and filling the channel's `Name` and `Platform`
12) Edit `COMMAND_PREFIX` in `data.Config` for your preferred command prefix
13) Run the bot as in **7)**, or `npm/yarn run debug` for debug access
