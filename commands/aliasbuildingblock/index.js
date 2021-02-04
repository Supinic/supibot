module.exports = {
    Name: "aliasbuildingblock",
    Aliases: ["abb"],
    Author: "supinic",
    Cooldown: 5000,
    Description: "A collection of smaller commands, only usable within aliases - and not as standalone commands. Consider these \"building blocks\" for more complex aliases, without needing to make them yourself.",
    Flags: ["pipe","skip-banphrase"],
    Params: [
        { name: "em", type: "string" },
        { name: "errorMessage", type: "string" },
        { name: "regex", type: "string" },
        { name: "replacement", type: "string" },
    ],
    Whitelist_Response: null,
    Static_Data: (() => ({
        blocks: [
            {
                name: "argumentsCheck",
                aliases: ["ac", "argCheck"],
                description: "Takes a number - expected amount of arguments as first argument. If the amount of actualy arguments is the same, simply returns output; if not, returns an error. You can specify a custom error message with the parameter em/errorMessage, where your underscores will be replaced by spaces.",
                execute: (context, inputAmount, ...args) => {
                    const amount = Number(inputAmount);
                    if (!sb.Utils.isValidInteger(amount)) {
                        return {
                            success: false,
                            reply: "Provided amount of arguments is not a valid integer!"
                        };
                    }

                    if (amount === args.length) {
                        return {
                            reply: args.join(" ")
                        };
                    }
                    else {
                        const reply = (
                            context.params.em
                            ?? context.params.errorMessage
                            ?? `Expected ${amount} arguments, got ${args.length} instead!`
                        ).replace(/_/g, " ");

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
                execute: async (context) => {
                    if (context.privateMessage) {
                        return {
                            success: false,
                            reply: "There is nobody else here 😨"
                        };
                    }

                    if (typeof context.channel.getUsers !== "function") {
                        return {
                            success: false,
                            reply: "This has not been implemented yet 4Head"
                        };
                    }

                    const users = await context.channel.getUsers();
                    return sb.Utils.randArray(users);
                }
            },
            {
                name: "explode",
                aliases: [],
                description: "Adds a space between all characters of the provided input - then, each one can be used as a specific argument.",
                execute: (context, ...args) => ({
                    reply: args.join(" ").split("").join(" ").replace(/\s+/g, " ")
                })
            },
            {
                name: "replace",
                aliases: [],
                description: "Takes two params: regex, replacement. For the given regex, replaces all matches with the provided value.",
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
            cooldown: null,
            ...result
        }
    }),
    Dynamic_Description: (async (prefix, values) => {
        const { blocks } = values.getStaticData();
        const list = blocks.map(i => {
            const aliases = (i.aliases.length > 0)
                ? `(${i.aliases.join(", ")})`
                : "";

            return `<li><code>${i.name}${aliases}</code><br>${i.description}</li>`
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