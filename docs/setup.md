# Setup

Setting Supibot up locally requires several steps, and is much easier if done with an interactive script.

### Interactive

1) Set up `MariaDB` of at least version `10.2.0` and credentials. Ideally, create a user separate for Supibot
2) `git clone` or `fork` the repository
3) Run `npm/yarn install`, depending on which package manager you use
4) Run `npm/yarn run setup` and walk through the interactive setup script, making sure to set up at least one platform, one channel and the command prefix
5) Run `npm/yarn start`, or `npm run debug / yarn debug` for debug access

### Manual

Alternatively, if `run setup` does not work or for whatever other reason, follow this manual setup:

1) Set up `MariaDB` of at least version `10.2.0` + credentials
2) `git clone` or `fork` the repository
3) Copy `db-access.js.example` as `db-access.js` (do **not** commit this file)
4) Fill in your `MariaDB` credentials to `db-access.js`, using sockets or hosts respectively
5) Run `npm/yarn install`
6) Run `npm/yarn run init-database`
7) Run `npm/yarn start` to verify that the bot can start up correctly. If it does, it will not attempt to join any platforms or channels. In order to do so, continue:
8) Fill in authentication token(s) in `data.Config`, depending on which platform to join - by editing its `Value` from `NULL` to given token
9) For each platform to join, edit its `chat_data.Platform` row and set up Supibot's account name `Self_Name`
10) Set up at least one channel per platform to `chat_data.Channel` table, by inserting a new row, and filling the channel's `Name` and `Platform`
11) Edit `COMMAND_PREFIX` in `data.Config` for your preferred command prefix
12) Run the bot as in **7)**, or `npm/yarn run debug` for debug access