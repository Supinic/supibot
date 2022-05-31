/**
 * Represents a user's AFK status
 */
module.exports = class AwayFromKeyboard extends require("./template.js") {
	/**
	 * @type {Map<number, AwayFromKeyboard>}
	 */
	static data = new Map();

	constructor (data) {
		super();

		/**
		 * Unique AFK status identifier
		 * @type {number}
		 */
		this.ID = data.ID;

		/**
		 * Unique numeric user identifier
		 * @type {User.ID}
		 */
		this.User_Alias = data.User_Alias;

		/**
		 * The timestamp of AFK status setup
		 * @type {sb.Date}
		 */
		this.Started = data.Started;

		/**
		 * AFK status description
		 * @type {string}
		 */
		this.Text = data.Text;

		/**
		 * If true, the AFK status will not be broadcasted when the user comes back from AFK
		 * @type {boolean}
		 */
		this.Silent = data.Silent;

		/**
		 * Determines the sort of "action" the user was doing while being AFK.
		 * E.g. "no longer AFK", "no longer taking a shower", ...
		 * @type {string}
		 */
		this.Status = data.Status ?? "afk";
	}

	async serialize () {
		throw new sb.Error({
			message: "Module AwayFromKeyboard cannot be serialized"
		});
	}

	static async reloadData () {
		AwayFromKeyboard.data.clear();
		return await this.loadData();
	}

	static async loadData () {
		const data = await sb.Query.getRecordset(rs => rs
			.select("*")
			.from("chat_data", "AFK")
			.where("Active = %b", true)
		);

		for (const record of data) {
			const afk = new AwayFromKeyboard(record);
			AwayFromKeyboard.data.set(afk.User_Alias, afk);
		}
	}

	/**
	 * @override
	 * @param {number[]} list
	 * @returns {Promise<boolean>}
	 */
	static async reloadSpecific (...list) {
		if (list.length === 0) {
			return false;
		}

		const values = [...AwayFromKeyboard.data.values()];

		const promises = list.map(async (ID) => {
			const row = await sb.Query.getRow("chat_data", "AFK");
			await row.load(ID);

			const existing = values.find(i => i.ID === ID);
			if (existing) {
				AwayFromKeyboard.data.delete(existing.User_Alias);
			}

			if (!row.values.Active) {
				return;
			}

			const created = new AwayFromKeyboard(row.valuesObject);
			AwayFromKeyboard.data.set(created.User_Alias, created);
		});

		await Promise.all(promises);
		return true;
	}

	/**
	 * Checks if a user is AFK.
	 * If they are, returns their AFK data and unsets the AFK status.
	 * If the status is set as not silent, also emits an event to Master to send a message
	 * @param {User} userData
	 * @param {sb.Channel} channelData
	 * @returns {Promise<void>}
	 */
	static async checkActive (userData, channelData) {
		if (!AwayFromKeyboard.data.has(userData.ID)) {
			return;
		}

		// Extract the AFK data *FIRST*, before anything else is awaited!
		// This makes sure that no more (possibly incorrect) messages are sent before the response is put together.
		const data = AwayFromKeyboard.data.get(userData.ID);
		AwayFromKeyboard.data.delete(userData.ID);

		// This should only ever update one row, if everything is working properly.
		await sb.Query.getRecordUpdater(rs => rs
			.update("chat_data", "AFK")
			.set("Active", false)
			.where("ID = %n", data.ID)
		);

		const afkCommand = sb.Command.get("afk");
		const status = sb.Utils.randArray(afkCommand.staticData.responses[data.Status]);

		if (!data.Silent) {
			const userMention = channelData.Platform.createUserMention(userData);
			const message = `${userMention} ${status}: ${data.Text} (${sb.Utils.timeDelta(data.Started)})`;

			if (channelData.Mirror) {
				const mirroredMessage = `${userData.Name} ${status}: ${data.Text} (${sb.Utils.timeDelta(data.Started)})`;
				await channelData.mirror(mirroredMessage, null, { commandUsed: false });
			}

			const unpingedMessage = await sb.Filter.applyUnping({
				command: afkCommand,
				channel: channelData ?? null,
				platform: channelData?.Platform ?? null,
				string: message,
				executor: userData
			});

			const fixedMessage = await channelData.prepareMessage(unpingedMessage);
			await channelData.send(fixedMessage);
		}
	}

	static get (identifier) {
		if (identifier instanceof AwayFromKeyboard) {
			return identifier;
		}
		else if (identifier instanceof sb.User) {
			return AwayFromKeyboard.data.get(identifier.ID);
		}
		else if (typeof identifier === "number") {
			const values = [...AwayFromKeyboard.data.values()];
			return values.find(i => i.ID === identifier) ?? null;
		}
		else {
			throw new sb.Error({
				message: "Unrecognized AFK identifier type",
				args: typeof identifier
			});
		}
	}

	/**
	 * Sets (and creates a database row) a user's AFK status.
	 * @param {User} userData
	 * @param {Object} [data]
	 * @param {string} [data.Text]
	 * @param {sb.Date} [data.Started]
	 * @param {string} [data.Status]
	 * @param {boolean} [data.Silent] If true, user coming back will not be broadcast.
	 * @param {boolean} [data.Interrupted_ID] If true, user coming back will not be broadcast.
	 * @param {boolean} [data.extended] If true, the AFK status is extending a previous one.
	 * @returns {Promise<AwayFromKeyboard>}
	 */
	static async set (userData, data = {}) {
		const now = new sb.Date();
		const afkData = {
			User_Alias: userData.ID,
			Text: data.Text ?? null,
			Silent: Boolean(data.Silent),
			Started: data.Started ?? now,
			Status: data.Status ?? "afk",
			Interrupted_ID: data.Interrupted_ID ?? null
		};

		const row = await sb.Query.getRow("chat_data", "AFK");
		row.setValues(afkData);

		await row.save({ skipLoad: false });
		afkData.ID = row.values.ID;

		const afk = new AwayFromKeyboard(afkData);
		AwayFromKeyboard.data.set(userData.ID, afk);

		return afk;
	}
};
