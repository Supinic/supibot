module.exports = {
    Name: "checkem",
    Aliases: ["CheckEm", "check'em"],
    Author: "supinic",
    Cooldown: 30000,
    Description: "Similar to 4chan, posts the ID of your message as a number. Then, it checks it for dubs and higher.",
    Flags: ["mention", "pipe","skip-banphrase"],
    Whitelist_Response: null,
    Static_Data: (() => ({
        checks: {
            2: "dubs",
            3: "trips",
            4: "quads",
            5: "quints",
            6: "sexes",
            7: "septs",
            8: "octs",
            9: "nons",
            10: "decs"
        }
    })),
    Code: (async function checkEm (context) {
        let messageNumber;
        if (context.platform.Name === "twitch") {
            if (!context.append.messageID) {
                return {
                    success: false,
                    reply: `No message ID available! FeelsBadMan`
                };
            }

            messageNumber = BigInt("0x" + context.append.messageID.replace(/-/g, ""));
        }
        else if (context.platform.Name === "discord") {
            if (!context.append.messageID) {
                return {
                    success: false,
                    reply: `No message ID available on Discord just yet! Coming soon™`
                };
            }

            messageNumber = BigInt(context.append.messageID);
        }
        else {
            return {
                success: false,
                reply: `This command is not available on ${context.platform.capital}!`
            };
        }

        const croppedNumber = String(messageNumber).slice(-12);
        const list = croppedNumber.split("");
        const repeatedDigit = list.pop();

        let repeatsAmount = 1;
        let currentDigit = list.pop();
        while (currentDigit === repeatedDigit) {
            repeatsAmount++;
            currentDigit = list.pop();
        }

        const cooldown = {
            length: this.Cooldown,
            user: context.user.ID,
            channel: null,
            platform: null
        };

        if (repeatsAmount === 1) {
            return {
                reply: croppedNumber,
                cooldown
            };
        }

        const checkEmName = this.staticData.checks[repeatsAmount];
        if (repeatsAmount > 2) {
            console.log(`${checkEmName}!`, new sb.Date(), context.channel.Name, context.user.Name);
        }

        if (!checkEmName) {
            return {
                reply: `${croppedNumber} - you got more than 10 repeating digits?! Big gratz!`,
                cooldown
            };
        }

        return {
            reply: `${croppedNumber} - VisLaud Clap Congratulations on the ${checkEmName}!`,
            cooldown
        };
    }),
    Dynamic_Description: null
};