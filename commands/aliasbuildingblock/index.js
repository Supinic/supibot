module.exports = {
    Name: "aliasbuildingblock",
    Aliases: ["abb"],
    Author: "supinic",
    Cooldown: 5000,
    Description: "A collection of smaller commands, only usable within aliases - and not as standalone commands. Consider these \"building blocks\" for more complex aliases, without needing to make them yourself.",
    Flags: ["pipe","skip-banphrase"],
    Whitelist_Response: null,
    Static_Data: (() => ({
        blocks: [
            {
                name: "argumentsCheck",
                aliases: ["ac", "argCheck"],
                description: "Takes a number - expected amount of arguments as first argument. If the amount of actualy arguments is the same, simply returns output; if not, returns an error.",
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
                        return {
                            success: false,
                            reply: `Expected ${amount} arguments, got ${args.length} instead!`
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
                name: "say",
                aliases: ["echo"],
                description: "Simply outputs the input, with no changes.",
                execute: (context, ...args) => ({
                    reply: args.join(" ")
                })
            }
        ]
    })),
    Code: (async function aliasBuildingBlock (context, type, ...args) {
        if (!context.append.alias) {
            return {
                success: false,
                reply: "This command can only be used within aliases!"
            };
        }

        const { blocks } = this.staticData;
        if (!type) {
            return {
                success: false,
                reply: `No block type provided! Check help here: https//supinic.com/bot/command/${this.ID}`
            };
        }

        type = type.toLowerCase();
        const block = blocks.find(i => i.name === type || i.aliases.includes(type));
        if (!block) {
            return {
                success: false,
                reply: `Incorrect block type provided! Check help here: https//supinic.com/bot/command/${this.ID}`
            };
        }

        return await block.execute(context, ...args);
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