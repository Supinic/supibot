// @todo eventually merge these definitions with `supibot/commands/afk.js` static data
const afkResponses = require("./afk-responses.json");

module.exports = class AwayFromKeyboard extends require("./template.js") {
	static data = new Map();
	static defaultStatus = "afk";
	static uniqueIdentifier = "ID";

	constructor (data) {
		super();

		this.ID = data.ID;
		this.User_Alias = data.User_Alias;
		this.Started = data.Started;
		this.Text = data.Text;
		this.Silent = data.Silent;
		this.Status = data.Status ?? AwayFromKeyboard.defaultStatus;
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

		let statusMessage;
		const status = data.Status ?? AwayFromKeyboard.defaultStatus; // Fallback for old AFKs without `Status` property
		if (afkResponses.duration[status]) {
			const minutesDelta = (sb.Date.now() - data.Started.getTime()) / 60_000;
			const durationDefinitions = afkResponses.duration[status];

			for (const definition of durationDefinitions) {
				const { interval, responses } = definition;
				const minimum = interval[0] ?? 0;
				const maximum = interval[1] ?? Infinity;

				if (minimum < minutesDelta && minutesDelta < maximum) {
					statusMessage = sb.Utils.randArray(responses);
					break;
				}
			}

			statusMessage ??= sb.Utils.randArray(afkResponses.static[status]);
		}
		else {
			// Fallback for missing responses in the `afk-responses.json` file
			const responses = afkResponses.static[status] ?? afkResponses.static[AwayFromKeyboard.defaultStatus];
			statusMessage = sb.Utils.randArray(responses);
		}

		// const statusMessage = sb.Utils.randArray(afkResponses[data.Status] ?? afkResponses[AwayFromKeyboard.defaultStatus]);
		if (!data.Silent) {
			const userMention = await channelData.Platform.createUserMention(userData);
			const message = `${userMention} ${statusMessage}: ${data.Text} (${sb.Utils.timeDelta(data.Started)})`;

			if (channelData.Mirror) {
				const mirroredMessage = `${userData.Name} ${statusMessage}: ${data.Text} (${sb.Utils.timeDelta(data.Started)})`;
				await channelData.mirror(mirroredMessage, null, { commandUsed: false });
			}

			const unpingedMessage = await sb.Filter.applyUnping({
				command: "afk",
				channel: channelData ?? null,
				platform: channelData?.Platform ?? null,
				string: message,
				executor: userData
			});

			const fixedMessage = await channelData.prepareMessage(unpingedMessage);
			if (fixedMessage) {
				await channelData.send(fixedMessage);
			}
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
