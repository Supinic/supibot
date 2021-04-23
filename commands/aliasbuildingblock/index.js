module.exports = {
    Name: "aliasbuildingblock",
    Aliases: ["abb"],
    Author: "supinic",
    Cooldown: 5000,
    Description: "A collection of smaller commands, only usable within aliases - and not as standalone commands. Consider these \"building blocks\" for more complex aliases, without needing to make them yourself.",
    Flags: ["external-input","pipe","skip-banphrase"],
    Params: [
        { name: "em", type: "string" },
        { name: "errorMessage", type: "string" },
        { name: "excludeSelf", type: "boolean" },
        { name: "regex", type: "string" },
        { name: "replacement", type: "string" },
    ],
    Whitelist_Response: null,
    Static_Data: (() => ({
        blocks: [
            {
                name: "argumentsCheck",
                aliases: ["ac", "argCheck"],
                description: "Takes a number range - expected amount of arguments as first argument. If the amount of actual arguments falls in the range, simply returns output; if not, returns an error. You can specify a custom error message with the parameter em/errorMessage, where your underscores will be replaced by spaces.",
                examples: [
                    ["$abb argCheck 3 a b c", "a b c"],
                    ["$abb ac 1..5 a b c", "a b c"],
                    ["$abb ac ..2 a b c", "Error! ..2 arguments expected, got 3"],
                    ["$abb ac 5.. a", "Error! 5.. arguments expected, got 1"],
                    ["$abb ac 2 foo", "Error! Expected 2 arguments, got 1"],
                    ["$abb ac errorMessage:\"No I don't think so\" 2 foo", "Error! No I don't think so"],
                ],
                execute: (context, limit, ...args) => {
                    if (!limit) {
                        return {
                            success: false,
                            reply: `No argument limit provided!`
                        };
                    }
                    
                    const range = limit.split("..").map(i => i === "" ? null : Number(i));
                    if (range.length === 0) { // ".." - interpreted as "any"
                        return {
                            reply: args.join(" ")
                        };
                    }
                    else if (range.some(i => i !== null && !sb.Utils.isValidInteger(i))) {
                        return {
                            success: false,
                            reply: `Invalid arguments range provided`
                        };
                    }

                    range[0] = range[0] ?? 0;
                    if (range[1] === null) {
                        range[1] = Infinity;
                    }
                    else if (typeof range[1] === "undefined") {
                        range[1] = range[0];
                    }

                    if (range[0] > range[1]) {
                        return {
                            success: false,
                            reply: `Lower argument range bound must not be greater than the upper one!`
                        };
                    }                    
                    else if (range[0] <= args.length && args.length <= range[1]) {
                        return {
                            reply: args.join(" ")
                        };
                    }
                    else {
                        const reply = (
                            context.params.em
                            ?? context.params.errorMessage
                            ?? `Expected ${limit} arguments, got ${args.length} instead!`
                        );

                        return {
                            success: false,
                            reply
                        };
                    }
                }
            },
            {
                name: "chatter",
                aliases: [],
                description: "Selects a random chatter within the channel, and outputs their name. Not applicable in PMs.",
                examples: [
                    ["$abb chatter", "supinic"]
                ],
                execute: async (context) => {
                    if (context.privateMessage) {
                        return {
                            success: false,
                            reply: "There is nobody else here 😨"
                        };
                    }

                    if (typeof context.channel.fetchUserList !== "function") {
                        return {
                            success: false,
                            reply: "This has not been implemented here... yet! 4Head"
                        };
                    }

                    const users = await context.channel.fetchUserList();
                    const botIndex = users.findIndex(i => i.toLowerCase() === context.platform.Self_Name);
                    if (botIndex !== -1) {
                        users.splice(botIndex, 1);
                    }

                    if (context.params.excludeSelf) {
                        const index = users.findIndex(i => i.toLowerCase() === context.user.Name);
                        if (index !== -1) {
                            users.splice(index, 1);
                        }
                    }

                    return {
                        reply: sb.Utils.randArray(users)
                    };
                }
            },
            {
                name: "explode",
                aliases: [],
                description: "Adds a space between all characters of the provided input - then, each one can be used as a specific argument.",
                examples: [
                    ["$abb explode this is a test", "t h i s i s a t e s t"]
                ],
                execute: (context, ...args) => ({
                    reply: args.join(" ").split("").join(" ").replace(/\s+/g, " ")
                })
            },
            {
                name: "replace",
                aliases: [],
                description: "Takes two params: regex, replacement. For the given regex, replaces all matches with the provided value.",
                examples: [
                    ["$abb replace regex:/a+b/ replacement:lol aaaaaabbb", "lolbb"],
                    ["$abb replace regex:/foo/ replacement:NaM Damn foo spam", "Damn NaM spam"],
                ],
                execute: (context, ...args) => {
                    if (!context.params.regex || !context.params.replacement) {
                        return {
                            success: false,
                            reply: `Missing parameter(s)! regex, replacement`
                        };
                    }
                    
                    let regex;
                    try {
                        const string = context.params.regex.replace(/^\/|\/$/g, "");
                        const lastSlashIndex = string.lastIndexOf("/");

                        const regexBody = (lastSlashIndex !== -1) ? string.slice(0, lastSlashIndex) : string;
                        const flags = (lastSlashIndex !== -1) ? string.slice(lastSlashIndex + 1) : "";

                        regex = new RegExp(regexBody, flags);
                    }
                    catch (e) {
                        return {
                            success: false,
                            reply: `Could not create regex! ${e.message}`
                        };
                    }

                    return {
                        reply: args.join(" ").replace(regex, context.params.replacement)
                    };
                }
            },
            {
                name: "say",
                aliases: ["echo"],
                description: "Simply outputs the input, with no changes.",
                examples: [
                    ["$abb say hello", "hello"],
                ],
                execute: (context, ...args) => ({
                    reply: args.join(" ")
                })
            }
        ]
    })),
    Code: (async function aliasBuildingBlock(context, type, ...args) {
        const { blocks } = this.staticData;
        if (!context.append.alias) {
            if (!type) {
                return {
                    success: false,
                    reply: `This command can only be used within aliases! Check help here: https://supinic.com/bot/command/${this.ID}`
                };
            }

            type = type.toLowerCase();
            const block = blocks.find(i => i.name === type || i.aliases.includes(type));
            if (!block) {
                return {
                    success: false,
                    reply: `This command can only be used within aliases! Check help here: https://supinic.com/bot/command/${this.ID}`
                };
            }
            else {
                return {
                    success: false,
                    reply: `This command can only be used within aliases! Block description: ${block.description}`
                };
            }
        }

        if (!type) {
            return {
                success: false,
                reply: `No block type provided! Check help here: https://supinic.com/bot/command/${this.ID}`
            };
        }

        type = type.toLowerCase();
        const block = blocks.find(i => i.name === type || i.aliases.includes(type));
        if (!block) {
            return {
                success: false,
                reply: `Incorrect block type provided! Check help here: https://supinic.com/bot/command/${this.ID}`
            };
        }

        if (!context.append.alias) {
            return {
                success: false,
                reply: "This command can only be used within aliases!"
            };
        }

        const result = await block.execute(context, ...args);
        return {
            cooldown: result.cooldown ?? null,
            ...result
        }
    }),
    Dynamic_Description: (async (prefix, values) => {
        const { blocks } = values.getStaticData();
        const list = blocks.map(i => {
            const aliases = (i.aliases.length > 0)
                ? `(${i.aliases.join(", ")})`
                : "";

            const examples = (i.examples.length > 0)
                ? "<br><ul>" + i.examples.map(j => `<li><code>${j[0]}</code> ➡ <code>${j[1]}</code></li>`).join("") + "</ul>"
                : "";

            return `<li><code>${i.name}${aliases}</code><br>${i.description}${examples}</li>`
        });

        return [
            "This is a collection of smaller, simpler commands that are only usable within user-made aliases.",
            "These serve as a simplification of commonly used aliases, to make your life easier when making new aliases.",
            "",

            `<code>${prefix}abb (type)</code>`,
            `<code>${prefix}aliasbuildingblock (type)</code>`,
            "For a given block type, executes a small command to be used in the alias.",

            "Blocks:",
            "<ul>" + list.join("") + "</ul>"
        ];
    })
};