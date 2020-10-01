# Commands

Commands are the essential part of Supibot.
They create an interface for the chat user to interact with.
Any communication with the bot, external APIs or other bots is done via commands.

## List
The active command list can be found on:
- [supinic.com](https://supinic.com/bot/command/list) as a list. More info is available by clicking on the ID identifier.
- [GitHub](https://github.com/Supinic/supibot-sql) as a regularly updated repository of SQL update scripts.
Each command consists of its full description.
This means all flags, cooldowns, static data, aliases and dynamic descriptions are all available along with its JavaScript code.

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

## Definition

Supibot is rather unique in the fact that it stores its commands inside of a database table.
This allows for extremely easy reloading and testing without interrupting the bot runtime.
As such, version control is non-existant, but the project uses the [supibot-sql](https://github.com/Supinic/supibot-sql) repository along with a set of scripts to control versioning. 

### Table structure

- Name
    - This is the main name of the command. It will be used in any external reference to it (like, sql update file).
- Aliases
    - If not `NULL`, this is a JSON array of strings, where each string represents an alias. This means the same command can be executed with multiple so-called *invocations*.
    - If the JSON array is invalid, a warning will be printed, and an empty array will be used, as if the value was `NULL`.
- Description
    - Short text description of what the command does.
    - Should not be too long, as it should easily fit within a single chat message, without wrapping too much (~300 characters maximum).
    - Not used in the framework, mostly used by meta-commands, such as `help`.
- Cooldown
    - The implicit cooldown, measured in milliseconds.
    - Will be applied unless a [dynamic cooldown](#dynamic-cooldown) is used from the execution of a command.
- Flags
    - `@todo` 
    - Many columns currently specify various command setups
    - This is bound to be refactored into a `SET` column, or any other sort of flag column.
    - The aim of refactor is to reduce the amount of flag columns, which is quite high at this time. 
- Code
    - The command function code is stored as text here. 
    - This text is then `eval`-ed at the time of instancing the command.
    - If the evaluation fails, a warning will be printed, and a function returning an error message will be used as the command instead. 
- Static data
    - The command's static, constant data
    - Will be `eval`-ed and the result frozen with `Object.freeze`
    - In essence, it is usually:
        - an `Object` containing any unchanging custom data (e.g. strings, helpers functions)
        - an [IIFE](https://developer.mozilla.org/en-US/docs/Glossary/IIFE) that returns an `Object`.
        In its code, it can already access `this.data` of the command, as it has been initialized to empty object at that point.
        Keep in mind that this function must return an object to proceeed normally.
- Dynamic description
    - text containing a function that returns an `Array` of strings.
    - this is used as a extended description.
    - currently only used in the [supinic.com](https://github.com/supinic/supinic.com) project, and not in the bot itself. 

## Internal API
After figuring out that the user wants to invoke a command, each platform client will eventually execute `sb.Command.checkAndExecute`.
This method is the backbone of (almost) all command execution performed in Supibot. 
It will check whether a command exists in a given message, perform all additional parsing if needed, execute, handle all errors, and return to the platform client a string to reply with.

### `Command.checkAndExecute`

Useful for creators of new platform controllers.
In short, this method will determine whether a command invocation exists, and if it does, it attempts to execute given command with provided arguments.
It will also apply banphrases, string limits, cooldown and similar stuff.

A platform controller must parse the message, determine if a command is present, and this method handles the rest.
The controller must then send the reply based on the return value.
This can be different for each platform, hence why this level of abstraction exists. 

### Command code API
The entirety of each command's code consists of a single function. 
This function will be `await`-ed in `checkAndExecute` regardless of whether it is sync or async, so if asynchronous behaviour is requred, the function should be declared as `async`.

All command functions are await-ed.
So, if asynchronous operation is required, feel free to make the function `async` and use `await` inside of it.

#### Arguments
- `{Object} context` - contains information about the command execution context.
	- `{string} context.invocation` - the actual string with which the command was invoked - i.e. the `randomline` command can be executed with its `rl` alias instead, and then `"rl"` will be its invocation.
	- `{sb.User} context.user`- User instance of the person who invoked the command.
	 Can never be `null `in proper cases, as a command must always be executed by someone.
	 This does not apply for commands executed within other commands, but that's quite advanced and rarely enforced.  
	- `{sb.Platform} context.platform` - Platform instance
	- `{sb.Channel} [context.channel]` Channel instance, where the command was executed.
	 Will be `null` if the command is executed in private messages - whispers, DMs, whatever.
	- `{DatabaseConnector} context.transaction` If a command is rollbackable, it muse *this* database connector to ensure possible rollbacks.
	 For an example, refer to the [cookie](https://github.com/Supinic/supibot-sql/blob/master/commands/cookie.sql) command code for an example of using transactions properly.
	`{boolean} context.privateMessage` If true, the command is being invoked in PMs. Simply a visual sugar for checking `context.channel === null`.
	- `{Object} contex.append` More data about invocation context, most likely platform-specific.
	I.e. on Twitch, you can see the badges and user colour of the user who invoked it. 
	- `{sb.Command} context.command` Self instance of the command - deprecated, use `this` instead.
	All usages like this should be removed eventually.

- `{*[]} ...args` Everything the user types after the name of command is handled as `rest` arguments after `context`.
You can access each one separately, if needed; but if an unknown or variable amount is present, use the spread operator.
See examples below. 

#### `this` context
The function's `this` context is the command instance itself, parsed from how it appears in the database, with two notable changes:
- `{Object} this.data` By default, an empty object where the command can store any sort of session data, such as caches.
On reload, this data will always be lost.
- `{Object} this.staticData` is the result of parsing the database's `Static_Data`.
This object is frozen (`Object.freeze`) and thus cannot be modified at all.
Usually used for constant data tied only to the given command, so that they don't have to be stored elsewhere, without any links. 

#### Return value
Each command must return something to signify its success or failure.
This value is then processed by `Command.checkAndExecute`, and then used in a platform controller.

Types of supported return values:
- `{undefined|null|false}` Bot will not send any reply at all.
 If such behaviour is required, return `null` for best code readability.
- `{string|number|symbol|true|...}` Any other primitive is not supported.
 Returning such value will result in undefined behaviour. Don't do it.
- `{Object}` This is the proper way to return a value.
    - `{boolean} [success]` Determines whether the command was invoked successfully.
    Mostly used for meta commands, success itself is kind of redundant, because the bot will reply in either case.
    This flag just signifies whether the result string is a notification of failure, or the actual reply.
    If not defined, the command's state is considered a success. `false` must be explicitly stated to make the command result a failure.
	- `{string} [reason]` If the command results in a failure, this is a symbolic description of what caused the failure.
	Only used in meta commands, `Command.checkAndExecute` does not parse this option.
	- `{string} [reply]` If `success` is not `false`, this is the command reply. If it is, this is the failure reply. 
	- `{null|number|Object} [cooldown]` <a name="dynamic-cooldown">Dynamic cooldown.</a>
        - If not set, the default cooldown of given command will be applied to the current user/command/channel combination.
        - If `null`, no cooldown be set at all, not even the implicit one. Use with caution!
	    - If `number`, this value in milliseconds will be applied to the current user/command/channel combination.
        - If `Object`, more options are available: 
            - `{number} cooldown.length` Cooldown length in milliseconds. Must be set, otherwise the following options have no impact. 
            - `{number} [cooldown.channel]` Channel ID the cooldown should apply to. If not set, the channels will apply to all commands in the result context.
            - `{number} [cooldown.command]` Command ID the cooldown should apply to. If not set, the cooldown will apply to all commands in the result context.
            - `{number} [cooldown.user]` User ID the cooldown should apply to. If not set, the cooldown will apply to all users in the result context.
       - Examples
            - `channel` and `command` are set, but `user` is not: All users in given channel will be impacted.      		
            - `channel` and `user` are set, but `command` is not: User will be impacted by cooldown for all commands in given channel.      		
            - `channel` is set, but `command` and `user` are not: All users in given channel will be impacted for all commands.
            - ... etc.      		
	- `{Object} [meta]` Deprecated, used to contain cooldown metadata.

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
