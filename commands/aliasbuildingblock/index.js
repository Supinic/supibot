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
                name: "say",
                aliases: ["echo"],
                description: "Simply outputs the input, with no changes.",
                execute: (context, ...args) => ({
                    reply: args.join(" ")
                })
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