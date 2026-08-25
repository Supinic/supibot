# Commands

Commands are the essential part of Supibot.
They create an interface for the chat user to interact with.
Any communication with the bot, external APIs or other bots is done via commands.

## Definition
The active command list can be found in the [commands](../commands) directory.
Each directory consists of the command's definition in its `index.js` file.
The directory can contain more files such as JSON data, modules or tests.

### Command structure

- Name
    - this is the main name of the command. It will be used in any external references to it.
- Aliases
    - if `null`, then no aliases are used.    
    - otherwise, it is an array of strings, with alternative names. This means the same command can be executed with multiple so-called *invocations*.
- Description
    - short text description of what the command does.
    - should not be too long, as it should easily fit within a single chat message, without wrapping too much (~300 characters maximum).
    - not used in the framework, it is mostly used by meta-commands, such as `help`.
- Cooldown
    - the implicit cooldown, measured in milliseconds.
    - will be applied unless a [dynamic cooldown](#dynamic-cooldown) is used from the execution of a command.
- Parameters
    - `null` if no parameters are present
    - otherwise, it is an array of objects, with properties:
        - `{string} parameter.name` - simply the name of the parameter(s)
        - `{"string"|"number"|"boolean"|"date"|"object"|"regex"} parameter.type` the value will be parsed automatically according to this type
- Flags
    - `null` if no flags are present
    - oherwise, it is an array of strings, where each flag represents a flag set to true.
    - list of flags:
        - `archived` The command has been archived and is no longer in use.
        - `block` It is possible to use the `block` command to block specific users from this command's execution on them.
        - `developer` Is not shown on the website command list, unless the logged-in user is flagged as a developer.
        - `mention` Will mention users upon successful invocation.
        - `opt-out` It is possible to use the `optout` command to stop all users from executing this command on them.
        - `pipe` This command can be used in the `pipe` meta-command.
        - `read-only` Command has no response, and as such will set no cooldowns.
        - `rollback` A transaction will be provided to the command, and it will automatically commit (or rollback) based on if it succeeds or not.
        - `skip-banphrase` Result reply will not be checked against any banphrases.
        - `system` Is not shown on the website command list, unless the logged-in user is flagged as an administrator.
        - `whitelist` The command is not available by default, and only Whitelist Filters can allow the usage.  
- Code
    - the actual function code of the command.
- Static data
    - the command's static, constant data
    - result will be frozen with `Object.freeze` to prevent changes at runtime.
    - if not `null`, it is an [IIFE](https://developer.mozilla.org/en-US/docs/Glossary/IIFE) that returns an `Object`.
        In its code, it has access to `this.data` of the command, as it has been initialized to an empty object at that point.
        Keep in mind that this function must return an object for command execution to proceed normally.
- Dynamic description
    - if not `null`, it is a function that returns an `Array` of strings, which are then used as an extended description.
    - currently used in the [supinic.com](https://github.com/supinic/supinic.com) project, and not in the bot itself. 

## Internal API
After figuring out that the user wants to invoke a command, each platform client will eventually execute `sb.Command.checkAndExecute`.
This method is the backbone of (almost) all command execution performed in Supibot. 
It will check whether a command exists in a given message, perform any additional parsing if needed, execute, handle all errors, and return to the platform client a string to reply with.

### [`Command.checkAndExecute`](https://github.com/Supinic/supi-core/blob/master/classes/command.js)

Useful for creators of new platforms.
In short, this method will determine whether a command invocation exists in the input string. If it does, it then attempts to execute the given command with provided arguments.
It will also apply banphrases, string limits, cooldown and similar stuff.

A platform must parse the message, determine if a command is present, and this method handles the rest.
It must then send the reply based on the return value.
This can be different for each platform, hence why this level of abstraction exists. 

### Command code API
The entirety of each command's code consists of a single function. 
This function will be `await`-ed in `checkAndExecute` regardless of whether it is sync or async, so if asynchronous behaviour is required, the function should be declared as `async`.

All command functions are await-ed.
So, if asynchronous operation is required, feel free to make the function `async` and use `await` inside of it.

#### User parameters
If a command has at least one parameter defined, users can provide specific values for them.

Observe the following examples and notice the usage of quote marks for multi-word parameters. 
Also notice the overriding of the same parameter used multiple times.

- `$foo param:foo` ⇒ `{ param: "foo" }`
- `$foo param:foo not a part of the parameter` ⇒ `{ param: "foo" }`
- `$foo param:"foo bar"` ⇒ `{ param: "foo bar" }`
- `$foo param1:foo param2:"bar baz"` ⇒ `{ param1: "foo", param2: "bar baz" }`
- `$foo param:foo param:"overridden!"` ⇒ `{ param: "overridden!" }`

Additionally, Supibot has defined a constant `--` (available as `sb.Command.ignoreParametersDelimiter`) which allows execution to ignore all succeeding parameter-like strings. 
They will be instead used as the command input.
This is useful when the input of a command would include a literal definition of a parameter. 

- `$foo param:foo -- param:"not overridden"` ⇒ `{ param: "foo" }`
- `$translate to:german This text goes to:Someone` ⇒ `Error: Cannot recognize language "Someone"`
- `$translate to:german -- This text goes to:Someone` ⇒ `{ to: "german" }`

#### Arguments
- `{Object} context` - contains information about the command execution context.
	- `{string} context.invocation` - the actual string with which the command was invoked - i.e. the `randomline` command can be executed with its `rl` alias instead, and then `"rl"` will be its invocation.
	- `{sb.User} context.user` - User instance of the person who invoked the command.
	 Can never be `null` in proper cases, as a command must always be executed by someone.
	 This does not apply for commands executed within other commands, but that's quite advanced and rarely enforced.  
	- `{sb.Platform} context.platform` - Platform instance
	- `{sb.Channel} [context.channel]` Channel instance, where the command was executed.
	 Will be `null` if the command is executed in private messages - whispers, DMs, whatever.
	- `{DatabaseConnector} context.transaction` If a command is rollbackable, it must use *this* database connector to ensure possible rollbacks.
	`{boolean} context.privateMessage` If true, the command is being invoked in PMs. Simply a visual sugar for checking `context.channel === null`.
	`{Object} [context.params]` If the command has any parameters declared, this object will hold the values.
	- `{Object} context.append` More data about invocation context, most likely platform-specific.
	E.g. on Twitch, you can see the badges and user colour of the user who invoked it.

- `{*[]} ...args` Everything the user types after the name of command is handled as `rest` arguments after `context`.
You can access each one separately, if needed; but if an unknown or variable number of args is present, use the spread operator instead.
See examples below. 

#### Commands' `this` context
The function's `this` context is the command instance itself, parsed from how it appears in the database, with two notable changes:
- `{Object} this.data` By default, an empty object where the command can store any sort of session data, such as caches.
On reload, this data will always be lost.

#### Return value
Each command must explicitly return something to signify its success or failure.
This value is then processed by `Command.checkAndExecute`, and then used in the platform instance.

Return value description - `{Object}`:
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
        - `{number} [cooldown.channel]` Channel ID the cooldown should apply to. If not set, the cooldown will apply to all channels in the result context.
        - `{number} [cooldown.command]` Command ID the cooldown should apply to. If not set, the cooldown will apply to all commands in the result context.
        - `{number} [cooldown.user]` User ID the cooldown should apply to. If not set, the cooldown will apply to all users in the result context.
   - Examples
        - `channel` and `command` are set, but `user` is not: All users in the given channel will be impacted.      		
        - `channel` and `user` are set, but `command` is not: User will be impacted by cooldown for all commands in given channel.      		
        - `channel` is set, but `command` and `user` are not: All users in the given channel will be impacted for all commands.
        - ... etc.

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
import { SupiDate } from "supi-core";

(async function gag (context, ...args) {
    const options = { responseType: "json" };
    if (args.length === 0) {
        options.url = "https://9gag.com/v1/group-posts/group/default/type/hot";
    }
    else {
        options.url = "https://9gag.com/v1/search-posts";
        options.searchParams = {
            query: args.join(" ")
        };
    }

    const response = await core.Got.get("GenericAPI")(options);

    const nsfw = Boolean(context.channel?.NSFW);
    const filteredPosts = (nsfw)
        ? response.body.data.posts
        : response.body.data.posts.filter(i => i.nsfw !== 1);

    const post = core.Utils.randArray(filteredPosts);
    if (!post) {
        return {
            success: false,
            reply: `No suitable posts found!`
        };
    }

    const delta = core.Utils.timeDelta(new SupiDate(post.creationTs * 1000));
    return {
        reply: `${core.Utils.fixHTML(post.title)} - ${post.url} - Score: ${post.upVoteCount}, posted ${delta}.`
    };
})
```

## Prefix trivia
Supibot currently uses the character `$` (Unicode: `DOLLAR SIGN U+0024`) as its current command prefix.
On Twitch, this prefix can optionally be padded with a space in order to permit several emote-based commands with the emote showing up in chat as the image as well.
The prefix is semi-dynamic, as in - it can be changed, but not at runtime - a restart will be required.
However, do note: this was never attempted, and it is not recommended because of the rather sharp UX decrease.

Supibot's prefix was chosen in the following manner:
1. Identify the formal bot prefix - almost always `!`. Move on, as this would usually collide with other bots.
2. On the US keyboard layout, this key is accessed as `SHIFT+1`. Let's try and move to the right.
3. Check the following character, `@` as `SHIFT+2`. This is used to notify users and as such shouldn't be used as a prefix. Move on.
4. Next character: `#` as `SHIFT+3`. Used to signify channels on IRC, Twitch and Discord. Hardly usable, move on.
5. Final character: `$` as `SHIFT+4`. While it is often used at the start of messages to signify amounts of USD currency, as long as there are no (or at least, not many) commands consisting of just numbers, execution should be smooth. 
