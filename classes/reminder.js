/**
 * Represents a pending reminder from (usually) one user to another.
 * An active reminder will be printed into the chat once the target user is spotted.
 * @memberof sb
 * @type Reminder
 */
module.exports = class Reminder extends require("./template.js") {
    static LongTimeout = require("long-timeout");
    
    /** @type {Reminder} */
    constructor (data) {
        super();
        
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

        /**
         * If the reminder is a timed one, a timeout will be active that holds the info about the activation.
         * @type {LongTimeout|null}
         */
        this.timeout = null;
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

        /** @type {LongTimeout} */
        this.timeout = new Reminder.LongTimeout(async () => {
            /** @type {Channel|null} */
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
            if (statusAFK && channelData) {
                await sb.Reminder.create({
                    User_From: sb.Config.get("SELF_ID"),
                    User_To: toUserData.ID,
                    Platform: channelData.Platform.ID,
                    Channel: channelData.ID,
                    Created: new sb.Date(),
                    Active: true,
                    Schedule: null,
                    Text: `A timed reminder fired while you were AFK, check it here: https://supinic.com/bot/reminder/lookup?ID=${this.ID}`,
                    Private_Message: true
                }, true);
            }

            if (message) {
                if (this.Private_Message) {
                    const platform = channelData?.Platform ?? this.Platform;
                    await platform.pm(message, toUserData);
                }
                else {
                    if (channelData === null) {
                        throw new sb.Error({
                            message: "Cannot post a non-private reminder in an unspecified channel!",
                            args: {
                                reminderID: this.ID
                            }
                        })
                    }

                    if (channelData.Mirror) {
                        channelData.Platform.controller.mirror(message, toUserData, channelData, false);
                    }

                    message = await channelData.prepareMessage(message);
                    await channelData.send(message);
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

    destroy () {
        if (this.timeout) {
            this.timeout.clear();
            this.timeout = null;
        }
    }

    async serialize () {
        throw new sb.Error({
            message: "Module Reminder cannot be serialized"
        });
    }
    
    static async loadData () {
        const data = await sb.Query.getRecordset(rs => rs
            .select("*")
            .from("chat_data", "Reminder")
            .where("Active = %b", true)
            .where("Schedule IS NULL OR Schedule < (NOW() + INTERVAL 1 YEAR)")
        );

        Reminder.data = data.map(record => new Reminder(record));

        // This will deactivate expired reminders automatically, and skip over non-scheduled reminders.
        for (const reminder of Reminder.data) {
            reminder.activateTimeout();
        }
    }

    static async reloadData () {
        for (const reminder of Reminder.data) {
            reminder.destroy();
        }

        return await super.reloadData();
    }

    static async reloadSpecific (...list) {
        const promises = list.map(async (ID) => {
            const row = await sb.Query.getRow("chat_data", "Reminder");
            await row.load(ID);

            const existingIndex = Reminder.data.findIndex(i => i.ID === ID);
            if (existingIndex !== -1) {
                Reminder.data[existingIndex].destroy();
                Reminder.data.splice(existingIndex, 1);
            }

            if (!row.values.Active) {
                return;
            }

            const reminder = new Reminder(row.valuesObject);
            reminder.activateTimeout();
            Reminder.data.push(reminder);
        });

        await Promise.all(promises);
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
        
        super.destroy();
    } 

    /**
     * Creates a new Reminder, and saves it to database.
     * Used mostly in commands to set up reminders.
     * @param {Object} data {@link Reminder}-compliant data
     * @param {boolean} [skipChecks = false] If true, skips all reminder checks. This is done for system reminders, so they always go through.
     * @return {ReminderCreationResult}
     */
    static async create (data, skipChecks = false) {
        data.Active = true;

        if (!skipChecks) {
            const { success, cause } = await Reminder.checkLimits(data.User_From, data.User_To, data.Schedule);
            if (!success) {
                return { success, cause };
            }
        }

        if (!data.Platform) {
            console.warn("Creating reminder without platform!");
            data.Platform = 1;
        }

        const row = await sb.Query.getRow("chat_data", "Reminder");
        row.setValues(data);
        await row.save();
        data.ID = row.values.ID;

        const reminder = new Reminder(data);
        reminder.activateTimeout();
        Reminder.data.push(reminder);

        return {
            success: true,
            cause: null,
            ID: row.values.ID
        };
    }

    /**
     * @param {User} targetUserData The user ID to check for
     * @param {Channel} channelData The channel where the reminder was fired
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
        const sorter = async (flag, username, message, channelData) => {
            if (flag) {
                privateReply.push(`${username} - ${message}`);
            }
            else {
                const checkedMessage = await channelData.prepareMessage(message);
                reply.push(`${username} - ${checkedMessage}`);
            }
        };

        for (const reminder of reminders) {
            const platformData = channelData.Platform;
            const fromUserData = await sb.User.get(reminder.User_From);

            if (reminder.User_From === targetUserData.ID) {
                await sorter(
                    reminder.Private_Message,
                    "yourself",
                    reminder.Text + " (" + sb.Utils.timeDelta(reminder.Created) + ")",
                    channelData
                );
            }
            else if (fromUserData.Name === platformData.Self_Name) {
                await sorter(
                    reminder.Private_Message,
                    "system reminder",
                    reminder.Text + " (" + sb.Utils.timeDelta(reminder.Created) + ")",
                    channelData
                );
            }
            else if (reminder.Text !== null) {
                const { string } = await sb.Banphrase.execute(fromUserData.Name, channelData);
                const delta = sb.Utils.timeDelta(reminder.Created);

                await sorter(
                    reminder.Private_Message,
                    string,
                    `${reminder.Text} (${delta})`,
                    channelData
                );
            }
            else {
                const fromUserData = await sb.User.get(reminder.User_From, false);
                const channelName = channelData.getPlatformName();

                if (reminder.Private_Message) {
                    let platform = null;
                    if (reminder.Channel) {
                        platform = sb.Channel.get(reminder.Channel).Platform;
                    }
                    else {
                        platform = sb.Platform.get(reminder.Platform);
                    }

                    await platform.pm(
                        `@${fromUserData.Name}, ${targetUserData.Name} just typed in channel ${channelName}`,
                        fromUserData
                    );
                }
                else {
                    await sb.Channel.get(reminder.Channel).send(
                        `@${fromUserData.Name}, ${targetUserData.Name} just typed in channel ${channelName}`
                    );
                }

                reminder.deactivate(true);
            }
        }

        // Handle non-private reminders
        if (reply.length !== 0) {
            const notifySymbol = (channelData.Platform.Name === "discord") ? "@" : "";
            const checkedUsername = `${notifySymbol}${targetUserData.Name},`;
            const checkResult = await channelData.prepareMessage(checkedUsername, {
                returnBooleanOnFail: true,
                skipLengthCheck: true
            })

            const username = (checkResult === false) ? "[Banphrased username]," : checkResult;
            let message = "reminders from: " + reply.join("; ");

            // Check banphrases and do not check length limits, because it is later split manually
            message = await channelData.prepareMessage(message, {
                returnBooleanOnFail: true,
                skipLengthCheck: true
            });

            if (typeof message === "string") {
                message = `${username} ${message}`;

                // Apply unpings, governed by the reminder command itself
                message = await sb.Filter.applyUnping({
                    command: sb.Command.get("remind"),
                    channel: channelData ?? null,
                    platform: channelData?.Platform ?? null,
                    string: message
                });

                const limit = channelData.Message_Limit ?? channelData.Platform.Message_Limit;

                // If the result message would be longer than twice the channel limit, post a list of reminder IDs
                // instead along with a link to the website, where the user can check them out.
                if (message.length > (limit * 2)) {
                    const listID = reminders.filter(i => !i.Private_Message).map(i => `ID=${i.ID}`).join("&");
                    message = sb.Utils.tag.trim `
                        Hey ${notifySymbol}${targetUserData.Name},
                        you have reminders, but they're too long to be posted here. 
                        Check them out here:
                        https://supinic.com/bot/reminder/lookup?${listID}
                    `;
                }

                const messageArray = sb.Utils.partitionString(message, limit, 2);
                for (const splitMessage of messageArray) {
                    await Promise.all([
                        channelData.send(splitMessage),
                        channelData.mirror(splitMessage, targetUserData, false)
                    ]);
                }
            }
            else {
                const listID = reminders.map(i => `ID=${i.ID}`).join("&");
                const message = sb.Utils.tag.trim `
                    Hey ${notifySymbol}${targetUserData.Name},
                    the banphrase check for your reminders failed.
                    Check them out here:
                    https://supinic.com/bot/reminder/lookup?${listID}
                `;

                await channelData.send(message);
            }
        }

        // Handle private reminders
        if (privateReply.length !== 0) {
            for (const privateReminder of privateReply) {
                await channelData.Platform.pm("Private reminder: " + privateReminder, targetUserData);
            }

            const publicMessage = `Hey ${targetUserData.Name} - I just whispered you ${privateReply.length} private reminder(s) - make sure to check them out!`;
            await Promise.all([
                channelData.send(publicMessage),
                channelData.mirror(publicMessage, targetUserData, false)
            ]);
        }
    }

    /**
     * Checks whether or not it is possible to set up a reminder for given user, respecting limits.
     * Used mostly in commands to set up reminders.
     * @param {number} userFrom
     * @param {number} userTo
     * @param {sb.Date} [schedule]
     * @return {ReminderCreationResult}
     */
    static async checkLimits (userFrom, userTo, schedule) {
        const [incomingData, outgoingData] = await Promise.all([
            sb.Query.getRecordset(rs => rs
                .select("Private_Message")
                .from("chat_data", "Reminder")
                .where("Active = %b", true)
                .where("Schedule IS NULL")
                .where("User_To = %n", userTo)
            ),
            sb.Query.getRecordset(rs => rs
                .select("Private_Message")
                .from("chat_data", "Reminder")
                .where("Active = %b", true)
                .where("Schedule IS NULL")
                .where("User_From = %n", userFrom)
            )
        ]);

        const incomingLimit = sb.Config.get("MAX_ACTIVE_INCOMING_REMINDERS");
        const outgoingLimit = sb.Config.get("MAX_ACTIVE_OUTGOING_REMINDERS");
        const [privateIncoming, publicIncoming] = sb.Utils.splitByCondition(incomingData, i => i.Private_Message);
        const [privateOutgoing, publicOutgoing] = sb.Utils.splitByCondition(outgoingData, i => i.Private_Message);

        if (publicIncoming.length >= incomingLimit) {
            return {
                success: false,
                cause: "public-incoming"
            };
        }
        else if (publicOutgoing.length >= outgoingLimit) {
            return {
                success: false,
                cause: "public-outgoing"
            };
        }
        else if (privateIncoming.length >= incomingLimit) {
            return {
                success: false,
                cause: "private-outgoing"
            };
        }
        else if (privateOutgoing.length >= outgoingLimit) {
            return {
                success: false,
                cause: "private-outgoing"
            };
        }

        if (schedule) {
            const scheduleCheck = (await sb.Query.getRecordset(rs => rs
                .select("COUNT(*) AS Count")
                .from("chat_data", "Reminder")
                .where("Active = %b", true)
                .where("Schedule IS NOT NULL")
                .where("User_To = %n", userTo)
                .where("DAY(Schedule) = %n", schedule.day)
                .where("MONTH(Schedule) = %n", schedule.month)
                .where("YEAR(Schedule) = %n", schedule.year)
                .groupBy("YEAR(Schedule)", "MONTH(Schedule)", "DAY(Schedule)")
                .single()
            ));

            if (scheduleCheck && scheduleCheck.Count >= incomingLimit) {
                return {
                    success: false,
                    cause: "scheduled-incoming"
                };
            }
        }

        return {
            success: true
        };
    }
};

/**
 * @typedef {Object} ReminderCreationResult
 * @property {boolean} success Whether or not the reminder was created .
 * @property {number} [ID] If successful, this is the new reminder ID.
 * @property {string} [cause] If not successful, this is a string specifying what went wrong.
 */