/* global sb */
module.exports = (function () {
    "use strict";

    /**
     * Represents a chat user.
     * Since there can be hundreds of thousands of users loaded, a class is used to simplify the prototype, and potentially save some memory and/or processing power with V8.
     * @memberof sb
     * @type User
     */
    const User = class User {
        /** @alias {User} */
        constructor (data) {
            /**
             * Unique numeric ID.
             * @type {number}
             */
            this.ID = data.ID;

            /**
             * Unique Discord identifier.
             * Only verified users (non-null Discord ID value) can use the bot on Discord.
             * @type {number}
             */
            this.Discord_ID = data.Discord_ID;

            /**
             * Unique Mixer identifier.
             * @type {number}
             */
            this.Mixer_ID = data.Mixer_ID;

            /**
             * Unique Twitch identifier.
             * @type {number}
             */
            this.Twitch_ID = data.Twitch_ID;

            /**
             * Unique name.
             * @type {string}
             */
            this.Name = data.Name;

            /**
             * Date of first sighting.
             * @type {sb.Date}
             */
            this.Started_Using = data.Started_Using;

            /**
             * Extra data given to each user.
             * @type {Object}
             */
            try {
                this.Data = (data.Data) ? JSON.parse(data.Data) : {};
            }
            catch (e) {
                console.warn("User data parse error", e);
                this.Data = {};
            }

            this.Following = Boolean(data.Following);

            this.Follow_Date = data.Follow_Date || null;
        }

        /**
         * Pushes a property change to the dataabse.
         * @param {string} property
         * @param {*} value
         * @returns {Promise<void>}
         */
        async saveProperty (property, value) {
            this[property] = value;
            const row = await sb.Query.getRow("chat_data", "User_Alias");
            await row.load(this.ID);

            if (value && value.constructor === Object) {
                value = JSON.stringify(value, null, 4);
            }

            row.values[property] = value;
            await row.save();
        }

        /** @override */
        static async initialize () {
            User.data = new Map();
            await User.loadData();
            return User;
        }

        static async loadData () {
            /** @type {Map<string, User>} */
            User.data = User.data || new Map();

            const data = (await sb.Query.getRecordset(rs => rs
                .select("User_Alias.*")
                .from("chat_data", "User_Alias")
                .where("Well_Known = %b", true)
                .where("1 = 0") // @todo this is a temporary test - batch the users sometime else
            ));

            for (const row of data) {
                User.data.set(row.Name, new User(row));
            }
        }

        static async reloadData () {
            User.data.clear();
            await User.loadData();
        }

        /**
         * Searches for a user, based on their ID, or Name.
         * Returns immediately if identifier is already a User.
         * @param {User|number|string} identifier
         * @param {boolean} strict If false and searching for user via string, and it is not found, creates a new User.
         * @returns {User|void}
         * @throws {sb.Error} If the type of identifier is unrecognized
         */
        static async get (identifier, strict = true) {
            if (identifier instanceof User) {
                return identifier;
            }
            else if (typeof identifier === "number") {
                let user = User.getByProperty("ID", identifier);
                if (!user) {
                    const data = (await sb.Query.getRecordset(rs => rs
                        .select("*")
                        .from("chat_data", "User_Alias")
                        .where("ID = %n", identifier)
                    ))[0];

                    if (data) {
                        user = new User(data);
                        User.data.set(data.Name, user);
                    }
                }

                return user;
            }
            else if (typeof identifier === "string") {
                identifier = identifier.replace(/^@/, "").toLowerCase();
                let user = User.data.get(identifier);

                if (!user) {
                    const data = (await sb.Query.getRecordset(rs => rs
                        .select("*")
                        .from("chat_data", "User_Alias")
                        .where("Name = %s", identifier)
                    ))[0];

                    if (data) {
                        user = new User(data);
                        User.data.set(data.Name, user);
                    }
                    else if (!strict) {
                        user = await User.add(identifier);
                    }
                }

                return user;
            }
            else {
                throw new sb.Error({
                    message: "Invalid user identifier type",
                    args: { id: identifier, type: typeof identifier }
                });
            }
        }

        /**
         * Synchronously fetches a user based on their numeric ID.
         * No other types of ID are supported.
         * @param {string} property
         * @param {number} identifier
         * @returns {User|void}
         */
        static getByProperty (property, identifier) {
            const iterator = User.data.values();
            let user = undefined;
            let value = iterator.next().value;

            while (!user && value) {
                if (value[property] === identifier) {
                    user = value;
                }
                value = iterator.next().value;
            }

            return user;
        }

        /**
         * Adds a new user to the database.
         * @param {string} name
         * @returns {Promise<User>}
         */
        static async add (name) {			
			const escapedName = sb.Query.escapeString(name.toLowerCase().replace(/\s+/g, "_"));
            const row = await sb.Query.getRow("chat_data", "User_Alias");
			const data = await sb.Query.raw([
				"INSERT INTO chat_data.User_Alias",
				"(Name)",
				`VALUES ("${escapedName}")`,
				`ON DUPLICATE KEY UPDATE Name = "${escapedName}"`
			].join(" "));

			// No user was added - do not continue
			if (data.insertId === 0) {
                return await User.get(escapedName);
            }
			
            await row.load(data.insertId);

            const user = new User(row.valuesObject);
            User.data.set(user.Name, user);
            return user;
        }

        /**
         * Cleans up.
         */
        static destroy () {
            User.data.clear();
        }
    };

    return User;
})();
