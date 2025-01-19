const Filter = require("./filter.js");
const User = require("./user.js");
import Template from "./template.js";

const { responses } = require("./afk-definitions.json");
const { responses: configResponses } = require("../config.json");

export default class AwayFromKeyboard extends Template {
	static data = new Map();
	static defaultStatus = "afk";
	static uniqueIdentifier = "ID";

	static #activeGauge;
	static #totalCounter;

	constructor (data) {
		super();

		this.ID = data.ID;
		this.User_Alias = data.User_Alias;
		this.Started = data.Started;
		this.Text = data.Text;
		this.Silent = data.Silent;
		this.Status = data.Status ?? AwayFromKeyboard.defaultStatus;
	}

	static async initialize () {
		if (sb.Metrics) {
			AwayFromKeyboard.#totalCounter = sb.Metrics.registerCounter({
				name: "supibot_afk_statuses_created_total",
				help: "Total amount of all AFK statuses created.",
				labelNames: ["type"]
			});

			AwayFromKeyboard.#activeGauge = sb.Metrics.registerGauge({
				name: "supibot_active_afk_statuses_count",
				help: "Total amount of currently active AFK status."
			});
		}

		return await super.initialize();
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

		if (sb.Metrics) {
			AwayFromKeyboard.#activeGauge.set(AwayFromKeyboard.data.size);
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

		if (sb.Metrics) {
			AwayFromKeyboard.#activeGauge.dec(1);
		}

		let statusMessage;
		const status = data.Status ?? AwayFromKeyboard.defaultStatus; // Fallback for old AFKs without `Status` property
		if (responses.duration[status]) {
			const minutesDelta = (sb.Date.now() - data.Started.getTime()) / 60_000;
			const durationDefinitions = responses.duration[status];

			for (const definition of durationDefinitions) {
				const minimum = definition.interval[0] ?? 0;
				const maximum = definition.interval[1] ?? Infinity;

				if (minimum < minutesDelta && minutesDelta < maximum) {
					statusMessage = sb.Utils.randArray(definition.responses);
					break;
				}
			}

			statusMessage ??= sb.Utils.randArray(responses.static[status]);
		}
		else {
			// Fallback for missing responses in the `afk-responses.json` file
			const staticResponses = responses.static[status] ?? responses.static[AwayFromKeyboard.defaultStatus];
			statusMessage = sb.Utils.randArray(staticResponses);
		}

		/**
		 * @todo Whenever the AFK table is split into AFK and AFK_History (similar to Reminder), only keep the Silent
		 * flag in the historical table and the active one should not have it. Then remove this condition.
 		 */
		if (!data.Silent) {
			const userMention = await channelData.Platform.createUserMention(userData);
			const fixedReminderText = await channelData.prepareMessage(data.Text) ?? configResponses.defaultBanphrase;

			const message = `${userMention} ${statusMessage}: ${fixedReminderText} (${sb.Utils.timeDelta(data.Started)})`;
			if (channelData.Mirror) {
				const mirroredMessage = `${userData.Name} ${statusMessage}: ${data.Text} (${sb.Utils.timeDelta(data.Started)})`;
				await channelData.mirror(mirroredMessage, null, { commandUsed: false });
			}

			const unpingedMessage = await Filter.applyUnping({
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
		else if (identifier instanceof User) {
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

		if (sb.Metrics) {
			AwayFromKeyboard.#totalCounter.inc({
				type: afkData.Status
			});

			AwayFromKeyboard.#activeGauge.inc(1);
		}

		return afk;
	}
};
