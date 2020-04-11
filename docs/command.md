# Commands

Commands are the essential part of Supibot.
They create an interface for the chat user to interact with.
Any communication with the bot, external APIs or other bots is done via commands.

## Prefix
Supibot currently uses the character `$` (Unicode: `DOLLAR SIGN U+0024`) as its current command prefix.
On Twitch, this prefix can optionally be padded with a space in order to permit several emote-based commands with the emote showing up in chat as the image as well.
The prefix is semi-dynamic, as in - it can be changed, but not at runtime - a restart will be required.
Do note however, that this was never attempted, and it is not recommended because of the rather sharp UX decrease.

Supibot's prefix was chosen in the following manner:
1. Identify the formal bot prefix - almost always `!`. Move on, as this would usually collide with other bots.
2. On the US keyboard layout, this key is accessed as `SHIFT+1`. Let's try and move to the right.
3. Check the following character, `@` as `SHIFT+2`. This is used to notify users and as such shouldn't be used as a prefix. Move on.
4. Next character: `#` as `SHIFT+3`. Used to signify channels on IRC, Twitch and Discord. Hardly usable, move on.
5. Final character: `$`  as `SHIFT+4`. While it is often used at the start of messages to signify amounts of USD currency, as long as there are no (or at least, not many) commands consisting of just numbers, execution should be smooth. 

## Structure

## Internal API
After figuring out that the user wants to invoke a command, each platform client will eventually execute `sb.Command.checkAndExecute`.
This method is the backbone of (almost) all command execution performed in Supibot. 
It will check whether a command exists in a given message, perform all additional parsing if needed, execute, handle all errors, and return to the platform client a string to reply with.

### `checkAndExecute`
Useful for creators of new platform clients.

`@todo`

### Command Code API
The entirety of each command's code consists of a single function. 
This function will be `await`ed in `checkAndExecute`, so if asynchronous behaviour is requred, the function should be declared as `async`.

`@todo`
all command functions are await-ed, so if asynchronous operation(s) is required, feel free to make it async and use await inside

context: this = sb.Command instance

input arguments: context, ...args

context - object with extra command context
{
	platform - {sb.Platform} Platform instance
	invocation - {string} the actual string with which the command was invoked
	user - {sb.User} User instance
	channel - {sb.Channel} Channel instance. Will be null if command is used in PMs
	command: {sb.Command} instance - deprecated, use (this) instead
	transaction: {DatabaseConnector} if a command is rollbackable, it muse this database connector to ensure possible rollbacks. see "cookie" command code for an example
	privateMessage: {boolean} if true, the command is being invoked in PMs
	append: {Object} more data, usually platform-specific
}

(...args) - everything that the user types after the command, split by spaces

return value possibilities:
	undefined/null/false - bot will not send any message at all. if such behaviour is required, use null for best readability
	
	any other primitives: unsupported, results in undefined behaviour
	
	{
		{boolean} success Determines whether the command was invoked successfully.
		{string} reply If success is true, this is the command's reply as it will enter the chat; it is also further pipable. If success is false, this is the "error message" the user will receive; it is NOT further pipable.
		{number|Object} cooldown Dynamic cooldown.
			If it's a number, the specified cooldown will be applied to user/command/channel combination.
			If it's an object, more options are available. 
			If null, no cooldown be set at all (!)
			If not set, the default cooldown will be applied to user/command/channel combination.
		{number} cooldown.length cooldown length
		{number} [cooldown.command]
		{number} [cooldown.channel]
		{number} [cooldown.user]
		
		{string} reason If command result is a failure, this is a symbolic description of what caused the failure. Mostly used in $pipe only.
		{Object} meta Deprecated, used to contain cooldown data
	}

#### List
Current command list can be found on:
- [supinic.com](https://supinic.com/bot/command/list) as a list. More info is available by clicking on the ID identifier.
- [GitHub](https://github.com/Supinic/supibot-sql) as a regularly updated repository of SQL update scripts.
Each command consists of its full description.
This means all flags, cooldowns, static data, aliases and dynamic descriptions are all available along with its JavaScript code.

#### Examples

##### Simple command
```js
(async function about () {
	return {	
		reply: "Supibot is a smol variety and utility bot supiniL running on a smol Raspberry Pi 3B supiniL not primarily designed for moderation supiniHack running on Node.js since Feb 2018."
	};
})
```
Note: While it is true the function does not use any async functionality, and **should** therefore be declared as synchronous; all Supibot command functions are declared as async for ease of manual command lookup.
Since all command code functions are `await`ed, it doesn't really make a difference anyway. 

##### Intermediate command
```js
(async function sort (context, ...args) {
    if (args.length < 2) {
        return {
            success: false,
            reply: "You must supply at least two words!"
        };
    }

    const reply = args.sort().join(" ");
    return {
        reply: reply, 
        cooldown: (context.append.pipe)
            ? null // skip cooldown in pipe
            : this.Cooldown // apply regular cooldown inside of pipe
    };
})
```

##### Advanced command using an external API
```js
(async function wiki (context, ...args) {
    if (args.length === 0) {
        return {
            reply: "No article specified!",
            cooldown: { length: 2500 }
        };
    }

    let language = "en";
    for (let i = args.length - 1; i >= 0; i--) {
        const token = args[i];
        if (/lang:\w+/.test(token)) {
            language = sb.Utils.languageISO.getCode(token.split(":")[1]);
            if (language === null) {
                return {
                    reply: "Invalid language provided!",
                    cooldown: { length: 1000 }
                };
            }

            language = language.toLowerCase();
            args.splice(i, 1);
        }
    }

    const rawData = await sb.Got({
        url: `https://${language}.wikipedia.org/w/api.php`,
        searchParams: new sb.URLParams()
            .set("format", "json")
            .set("action", "query")
            .set("prop", "extracts")
            .set("redirects", "1")
            .set("titles", args.map(i => sb.Utils.capitalize(i)).join(" "))
            .toString()
    }).json();

    const data = rawData.query.pages;
    const key = Object.keys(data)[0];
    if (key === "-1") {
        return { reply: "No results found!" };
    }
    else {
        let link = "";
        if (!context.channel || context.channel.Links_Allowed === true) {
            link = `https://${language}.wikipedia.org/?curid=${key}`;
        }

        return {
            reply: link + " " + data[key].title + ": " + sb.Utils.removeHTML(data[key].extract)
        };
    }
})
```