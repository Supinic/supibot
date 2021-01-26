module.exports = {
    Name: "automodcheck",
    Aliases: ["amc"],
    Author: "supinic",
    Cooldown: 2500,
    Description: "For a Twitch message outside of whispers, this command will show you how AutoMod sees it - posting how offensive it is in several categories.",
    Flags: ["mention","pipe"],
    Whitelist_Response: "For debugging purposes only :)",
    Static_Data: null,
    Code: (async function test (context) {
        if (context.platform.name !== "twitch") {
            return {
                success: false,
                reply: "Can't check for AutoMod outside of Twitch!"
            };
        }
        else if (context.privateMessage) {
            return {
                success: false,
                reply: "Can't check for toxicity in whispers!"
            };
        }
        else if (!context.append.flags) {
            return {
                reply: "No toxicity detected :)"
            };
        }

        const mapper = {
            S: "Sexual",
            P: "Profanity",
            I: "Identity",
            A: "Aggressive"
        };

        const counter = {};
        const words = context.append.flags.split(",");
        for (const word of words) {
            const rest = word.split(":")[1];
            const scores = rest.split("/");

            for (const score of scores) {
                const [type, value] = score.split(".");
                if (!type || !value) {
                    continue;
                }

                if (typeof counter[type] === "undefined") {
                    counter[type] = 0;
                }

                counter[type] += Number(value);
            }
        }

        const arr = Object.entries(counter).map(([key, value]) => `${mapper[key]}: ${value}`);
        return {
            reply: `Automod score: ${arr.join(", ")}`
        }
    }),
    Dynamic_Description: null
};