/**
 * Represents a reminder, as a mirror of the database table Reminder.
 * @type {module.Reminder}
 */
/* global sb */
module.exports = (function () {
    "use strict";
    const LongTimeout = require("long-timeout");

    /**
     * Represents a pending reminder.
     * @memberof sb
     * @type Reminder
     */
    return class Reminder {
        /** @type {Reminder} */
        constructor (data) {
            /**
             * Unique numeric ID.
             * @type {number}
             */
            this.ID = data.ID;

            /**
             * Whether or not the reminder is still active (primed).
             * @type {boolean}
             */
            this.Active = data.Active;

            /**
             * The user who set the reminder up.
             * Since anonymous reminders are not supported, this cannot be null.
             * @type {number}
             */
            this.User_From = data.User_From;

            /**
             * The user who the reminder is set up for.
             * If none is specified, it is a reminder for the origin user themselves.
             * @type {number}
             */
            this.User_To = data.User_To || data.User_From;

            /**
             * The channel the reminder was set up in.
             * This is necessary for timed reminders, as otherwise it is ambiguous where the reminder should be executed.
             * @typeof {number}
             */
            this.Channel = data.Channel;

            /**
             * The text of the reminder.
             * Can also be null, if the reminder is set up as "ping From when To types a message".
             * @type {string|null}
             */
            this.Text = data.Text;

            /**
             * Date of creation.
             * @type {sb.Date}
             */
            this.Created = data.Created;

            /**
             * Schedule date of reminder, if it's timed.
             * If null, reminder is tied to a user typing in chat.
             * @type {sb.Date}
             */
            this.Schedule = data.Schedule;

            /**
             * If true, the reminder is set to be fired into the user's PMs on the platform they next type in.
             * If false, regular behaviour is expected
             * @type {boolean}
             */
            this.Private_Message = data.Private_Message;

            /**
             * Platform of the reminder. Can be independent from the channel.
             * @type {number|null}
             */
            this.Platform = (data.Platform)
                ? sb.Platform.get(data.Platform)
                : null;
        }

        /**
         * Sets up the timeout of a timed reminder.
         * The reminder will be broadcasted in the origin channel.
         * @returns {Reminder}
         */
        activateTimeout () {
            if (!this.Schedule) {
                return this;
            }
            else if (new sb.Date() > this.Schedule) {
                this.deactivate(true);
                return this;
            }

            /** @type {module.LongTimeout} */
            this.timeout = new LongTimeout(async () => {
                const channelData = (this.Channel === null) ? null : sb.Channel.get(this.Channel);
                const fromUserData = await sb.User.get(this.User_From, true);
                const toUserData = await sb.User.get(this.User_To, true);
                let message = null;

                if (this.User_From === this.User_To) {
                    message = `@${fromUserData.Name}, reminder from yourself (${sb.Utils.timeDelta(this.Created)}): ${this.Text}`;
                }
                else if (this.User_From === sb.Config.get("SELF_ID")) {
                    message = `@${toUserData.Name}, system reminder (${sb.Utils.timeDelta(this.Created)}): ${this.Text}`;
                }
                else if (this.User_To) {
                    message = `@${toUserData.Name}, timed reminder from ${fromUserData.Name} (${sb.Utils.timeDelta(this.Created)}): ${this.Text}`;
                }

                const statusAFK = sb.AwayFromKeyboard.data.find(i => i.User_Alias === toUserData.ID);
                if (statusAFK) {
                    await sb.Reminder.create({
                        User_From: sb.Config.get("SELF_ID"),
                        User_To: toUserData.ID,
                        Channel: this.Channel,
                        Created: new sb.Date(),
                        Active: true,
                        Schedule: null,
                        Text: "This timed reminder fired while you were AFK: " + this.ID,
                        Private_Message: true
                    });
                }

                if (message) {
                    if (this.Private_Message) {
                        const platform = channelData?.Platform ?? this.Platform;
                        await sb.Master.pm(toUserData, message, platform);
                    }
                    else {
                        if (channelData === null) {
                            throw new sb.Error({
                                message: "Cannot post a non-private reminder in an unspecified channel!"
                            })
                        }

                        if (channelData.Mirror) {
                            sb.Master.mirror(message, toUserData, channelData.Mirror);
                        }

                        message = await sb.Master.prepareMessage(message, channelData);
                        sb.Master.send(message, channelData);
                    }
                }

                await this.deactivate(true);
            }, Number(this.Schedule), true);

            return this;
        }

        /**
         * Deactivates a reminder. Also deactivates it in database if required.
         * @param {boolean} success If true, the reminder was completed, and can be removed in database.
         * @returns {Reminder}
         */
        async deactivate (success) {
            this.Active = false;

            // Always deactivate timed reminder timeout
            if (this.timeout) {
                this.timeout.clear();
            }

            const index = Reminder.data.findIndex(i => i.ID === this.ID);
            if (index !== -1) {
                // Always remove reminder from the data collection
                Reminder.data.splice(index, 1);

                // If required, set the reminder as inactive in database
                if (success) {
                    const row = await sb.Query.getRow("chat_data", "Reminder");
                    await row.load(this.ID);
                    row.values.Active = false;
                    await row.save();
                }
            }
            return this;
        }

        /** @override */
        static async initialize () {
            await Reminder.loadData();
            return Reminder;
        }

        static async loadData () {
            Reminder.data = (await sb.Query.getRecordset(rs => rs
                .select("*")
                .from("chat_data", "Reminder")
                .where("Active = %b", true))).map(record => new Reminder(record));

            // This will deactivate expired reminder automatically, and skip over non-scheduled reminders.
            for (const reminder of Reminder.data) {
                reminder.activateTimeout();
            }
        }

        static async reloadData () {
            Reminder.destroy();
            Reminder.data = [];
            await Reminder.loadData();
        }

        static get (identifier) {
            if (identifier instanceof Reminder) {
                return identifier;
            }
            else if (typeof identifier === "number") {
                return Reminder.data.find(i => i.ID === identifier);
            }
            else {
                throw new sb.Error({
                    message: "Unrecognized reminder identifier type",
                    args: typeof identifier
                });
            }
        }

        static getByUser (options = {}) {
            return Reminder.data.filter(i => (
                (i.Active) &&
                (!options.from || i.User_From === options.from) &&
                (!options.to || i.User_To === options.to)
            ));
        }

        static destroy () {
            for (const reminder of Reminder.data) {
                reminder.Active = false;
                if (reminder.timeout) {
                    reminder.timeout.clear();
                    reminder.timeout = null;
                }
            }
            Reminder.data = [];
        }

        /**
         * Creates a new Reminder, and saves it to database.
         * Used mostly in commands to set up reminders.
         * @params {Object} data {@link Reminder}-compliant data
         * @params {boolean} [skipChecks = false] If true, skips all reminder checks. This is done for system reminders, so they always go through.
         * @throws {sb.Error} If maximum active reminders have been exceeded.
         */
        static async create (data, skipChecks = false) {
            data.Active = true;

            if (!skipChecks) {
                const countCheckFrom = (await sb.Query.getRecordset(rs => rs
                    .select("COUNT(*) AS Count")
                    .from("chat_data", "Reminder")
                    .where("Active = %b", true)
                    .where("Schedule IS NULL")
                    .where("User_From = %n", data.User_From)
                    .single()
                ));

                let countCheckTo = 0;
                if (data.User_To) {
                    countCheckTo = (await sb.Query.getRecordset(rs => rs
                        .select("COUNT(*) AS Count")
                        .from("chat_data", "Reminder")
                        .where("Active = %b", true)
                        .where("Schedule IS NULL")
                        .where("User_To = %n", data.User_To)
                        .single()
                    ));
                }

                // @todo what an amazing fix, "* 2" 4HEad just make a new config (im too lazy to do this from RDP)
                if (countCheckFrom && countCheckFrom.Count >= sb.Config.get("MAX_ACTIVE_REMINDERS") * 2) {
                    throw new sb.Error({
                        message: "You have too many pending reminders!"
                    });
                }
                else if (countCheckTo && countCheckTo.Count >= sb.Config.get("MAX_ACTIVE_REMINDERS")) {
                    throw new sb.Error({
                        message: "That person has too many pending reminders!"
                    });
                }

                if (data.Schedule) {
                    const scheduleCheck = (await sb.Query.getRecordset(rs => rs
                        .select("COUNT(*) AS Count")
                        .from("chat_data", "Reminder")
                        .where("Active = %b", true)
                        .where("Schedule IS NOT NULL")
                        .where("User_To = %n", data.User_To)
                        .where("DAY(Schedule) = %n", data.Schedule.day)
                        .where("MONTH(Schedule) = %n", data.Schedule.month)
                        .where("YEAR(Schedule) = %n", data.Schedule.year)
                        .groupBy("YEAR(Schedule)", "MONTH(Schedule)", "DAY(Schedule)")
                        .single()
                    ));

                    if (scheduleCheck && scheduleCheck.Count >= sb.Config.get("MAX_ACTIVE_REMINDERS")) {
                        throw new sb.Error({
                            message: "That person has too many pending timed reminders for that target day!"
                        });
                    }
                }
            }

            const row = await sb.Query.getRow("chat_data", "Reminder");
            row.setValues(data);
            await row.save();
            data.ID = row.values.ID;

            const reminder = new Reminder(data);
            reminder.activateTimeout();
            Reminder.data.push(reminder);

            return row.values.ID;
        }

        /**
         * @param {User} targetUserData The user ID to check for
         * @param {Channel} channelData The channel ID the reminder was fired in.
         */
        static async checkActive (targetUserData, channelData) {
            /** @typeof {Reminder[]} */
            const reminders = Reminder.data.filter(i => !i.Schedule && i.User_To === targetUserData.ID);
            if (reminders.length === 0) {
                return;
            }

            for (const reminder of reminders) {
                reminder.deactivate(true);
            }

            const reply = [];
            const privateReply = [];
            const sorter = async (flag, message, channelData) => {
                if (flag) {
                    privateReply.push(message);
                }
                else {
                    reply.push(await sb.Master.prepareMessage(message, channelData));
                }
            };

            for (const reminder of reminders) {
                if (reminder.User_From === targetUserData.ID) {
                    await sorter(
                        reminder.Private_Message,
                        "yourself - " + reminder.Text + " (" + sb.Utils.timeDelta(reminder.Created) + ")",
                        channelData
                    );
                }
                else if (reminder.User_From === sb.Config.get("SELF_ID")) {
                    const fromUserData = await sb.User.get(reminder.User_From, false);
                    await sorter(
                        reminder.Private_Message,
                        "System reminder - " + reminder.Text + " (" + sb.Utils.timeDelta(reminder.Created) + ")",
                        channelData
                    );
                }
                else if (reminder.Text !== null) {
                    const fromUserData = await sb.User.get(reminder.User_From, false);
                    await sorter(
                        reminder.Private_Message,
                        fromUserData.Name + " - " + reminder.Text + " (" + sb.Utils.timeDelta(reminder.Created) + ")",
                        channelData
                    );
                }
                else {
                    const fromUserData = await sb.User.get(reminder.User_From, false);
                    const sourceChannelName = (channelData.Platform === "Twitch")
                        ? channelData.Name
                        : channelData.Platform;

                    if (reminder.Private_Message) {
                        let platform = null;
                        if (reminder.Channel) {
                            platform = sb.Channel.get(reminder.Channel).Platform;
                        }
                        else {
                            platform = sb.Platform.get(reminder.Platform);
                        }

                        sb.Master.pm(
                            fromUserData.Name,
                            "@" + fromUserData.Name + ", " + targetUserData.Name + " just typed in channel " + sourceChannelName,
                            platform
                        );
                    }
                    else {
                        sb.Master.send(
                            "@" + fromUserData.Name + ", " + targetUserData.Name + " just typed in channel " + sourceChannelName,
                            reminder.Channel
                        );
                    }

                    reminder.deactivate(true);
                }
            }

            // Handle non-private reminders
            if (reply.length !== 0) {
                const notifySymbol = (channelData.Platform.Name === "discord") ? "@" : "";
                let message = notifySymbol + targetUserData.Name + ", reminders from: " + reply.join("; ");

                // Check banphrases and do not check length limits, because it is later split manually
                message = await sb.Master.prepareMessage(message, channelData, {
                    returnBooleanOnFail: true,
                    skipLengthCheck: true
                });

                if (message) {
                    const limit = channelData.Message_Limit || sb.Config.get("DEFAULT_MSG_LIMIT_" + channelData.Platform.Name.toUpperCase());

                    // If the result message would be longer than twice the channel limit, post a list of reminder IDs
	                // instead along with a link to the website, where the user can check them out.
                    if (message.length > (limit * 2)) {
                    	const listID = reminders.filter(i => !i.Private_Message).map(i => i.ID).join(" ");
                    	message = `${notifySymbol}${targetUserData.Name} you have reminders, but they're too long to be posted here. Check these IDs: ${listID} here: https://supinic.com/bot/reminder/list`;
                    }

                    const splitRegex = new RegExp(".{1," + limit + "}", "g");
                    const messageArray = message.match(splitRegex).filter(Boolean);

                    for (const splitMessage of messageArray) {
                        sb.Master.send(splitMessage, channelData);

	                    // Make sure to mirror the reminder if the target channel is set up to be mirrored
	                    if (channelData.Mirror) {
		                    sb.Master.mirror(splitMessage, targetUserData, channelData.Mirror);
	                    }
                    }
                }
                else {
                    sb.Master.send(
                        targetUserData.Name + ", banphrase timed out, but you can check reminders on the website or with the check command. IDs: " + reminders.map(i => i.ID).join(", "),
                        channelData
                    );
                }
            }

            // Handle private reminders
            if (privateReply.length !== 0) {
                for (const privateReminder of privateReply) {
                    sb.Master.pm(targetUserData, "Private reminder: " + privateReminder, channelData.Platform);
                }

                const publicMessage = `Hey ${targetUserData.Name} - I just whispered you ${privateReply.length} private reminder(s) - make sure to check them out!`;
                sb.Master.send(publicMessage, channelData);
                if (channelData.Mirror) {
                    sb.Master.mirror(publicMessage, targetUserData, channelData.Mirror);
                }
            }
        }
    };
})();
