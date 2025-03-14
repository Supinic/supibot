import { SupiDate, SupiError } from "supi-core";
import type { Row, RecordUpdater, Counter, Gauge } from "supi-core";

import { TemplateWithId } from "./template.js";

import Filter from "./filter.js";
import User from "./user.js";
import type Channel from "./channel.js";

import afkDefinitions from "./afk-definitions.json" with { type: "json" };
import config from "../config.json" with { type: "json" };

export type Status = "afk" | "gn" | "brb" | "shower" | "poop" | "lurk" | "work" | "study" | "nap" | "food";

const { responses } = afkDefinitions;
const configResponses = config.responses;

type DurationStatus = {
	interval: [number, number];
	responses: string[];
};
const durationStatuses = responses.duration as Partial<Record<Status, DurationStatus[]>>;

const NO_TEXT_AFK = "(no message)" as const;
const DEFAULT_AFK_STATUS = "afk" as const;

type ConstructorData = {
	ID: AwayFromKeyboard["ID"];
	User_Alias: AwayFromKeyboard["User_Alias"];
	Started: AwayFromKeyboard["Started"];
	Text: AwayFromKeyboard["Text"] | null;
	Silent?: AwayFromKeyboard["Silent"];
	Status?: AwayFromKeyboard["Status"];
};
type DatabaseConstructorData = ConstructorData & { Active: boolean; };

type NewAfkData = ConstructorData & {
	Interrupted_ID?: AwayFromKeyboard["ID"];
};

export class AwayFromKeyboard extends TemplateWithId {
	readonly ID: number;
	readonly User_Alias: number;
	readonly Started: SupiDate;
	readonly Text: string;
	readonly Silent: boolean; // @todo change to `never`, or flat-out remove, once fully removed from code base
	readonly Status: Status | null;

	static readonly data: Map<number, AwayFromKeyboard> = new Map();
	static readonly uniqueIdentifier = "ID" as const;

	static #activeGauge: Gauge;
	static #totalCounter: Counter;

	constructor (data: ConstructorData) {
		super();

		this.ID = data.ID;
		this.User_Alias = data.User_Alias;
		this.Started = data.Started;
		this.Text = data.Text ?? "(no message)";
		this.Silent = data.Silent ?? false;
		this.Status = data.Status ?? DEFAULT_AFK_STATUS;
	}

	destroy () {}
	getCacheKey (): never {
		throw new SupiError({
			message: "AwayFromKeyboard module does not support `getCacheKey`"
		});
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
		const data = await sb.Query.getRecordset<ConstructorData[]>(rs => rs
			.select("*")
			.from("chat_data", "AFK")
			.where("Active = %b", true)
		);

		for (const record of data) {
			const afk = new AwayFromKeyboard(record);
			AwayFromKeyboard.data.set(afk.User_Alias, afk);
		}

		if (AwayFromKeyboard.#activeGauge) {
			AwayFromKeyboard.#activeGauge.set(AwayFromKeyboard.data.size);
		}
	}

	static async reloadSpecific (...list: AwayFromKeyboard["ID"][]) {
		if (list.length === 0) {
			return false;
		}

		const values = [...AwayFromKeyboard.data.values()];

		const promises = list.map(async (ID) => {
			const row = await sb.Query.getRow<DatabaseConstructorData>("chat_data", "AFK");
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

	static async checkActive (userData: User, channelData: Channel) {
		if (!AwayFromKeyboard.data.has(userData.ID)) {
			return;
		}

		// Extract the AFK data *FIRST*, before anything else is awaited!
		// This makes sure that no more (possibly incorrect) messages are sent before the response is put together.

		const data = AwayFromKeyboard.data.get(userData.ID) as AwayFromKeyboard; // Type cast due to condition above
		AwayFromKeyboard.data.delete(userData.ID);

		// This should only ever update one row, if everything is working properly.
		await sb.Query.getRecordUpdater((ru: RecordUpdater) => ru
			.update("chat_data", "AFK")
			.set("Active", false)
			.where("ID = %n", data.ID)
		);

		AwayFromKeyboard.#activeGauge.dec(1);

		let statusMessage;
		const status = data.Status ?? DEFAULT_AFK_STATUS; // Fallback for old AFKs without `Status` property
		if (durationStatuses[status]) {
			const minutesDelta = (SupiDate.now() - data.Started.getTime()) / 60_000;
			const durationDefinitions = durationStatuses[status];

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
			const staticResponses = responses.static[status] ?? responses.static[DEFAULT_AFK_STATUS];
			statusMessage = sb.Utils.randArray(staticResponses) as string; // @todo remove type cast when Utils are well-known
		}

		/**
		 * @todo Whenever the AFK table is split into AFK and AFK_History (similar to Reminder), only keep the Silent
		 * flag in the historical table and the active one should not have it. Then remove this condition.
 		 */
		if (!data.Silent) {
			const platform = channelData.Platform;
			if (!platform) {
				throw new SupiError({
					message: "Assert error - AFK's Channel does not have a Platform",
					args: {
						afk: data.ID,
						channel: channelData.ID
					}
				})
			}

			const userMention = await platform.createUserMention(userData);
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

	static get (identifier: AwayFromKeyboard | User | number) {
		if (identifier instanceof AwayFromKeyboard) {
			return identifier;
		}
		else if (identifier instanceof User) {
			return AwayFromKeyboard.data.get(identifier.ID);
		}
		else {
			const values = [...AwayFromKeyboard.data.values()];
			return values.find(i => i.ID === identifier) ?? null;
		}
	}

	/**
	 * Sets a new AFK status, optionally also extending ("interrupting") an existing one by providing
	 * an `Interrupted_ID` property. This means the ID in that property is the original AFK status,
	 * and the new one is supposed to continue its duration.
	 * @param userData User going AFK
	 * @param data
	 */
	static async set (userData: User, data: Partial<NewAfkData> = {}) {
		const now = new SupiDate();
		const afkData = {
			User_Alias: userData.ID,
			Text: data.Text ?? null,
			Silent: Boolean(data.Silent),
			Started: data.Started ?? now,
			Status: data.Status ?? "afk",
			Interrupted_ID: data.Interrupted_ID ?? null
		} as const;

		const row = await sb.Query.getRow<ConstructorData>("chat_data", "AFK");
		row.setValues(afkData);

		await row.save({ skipLoad: false });

		const afk = new AwayFromKeyboard({
			ID: row.values.ID as number,
			User_Alias: userData.ID,
			Text: data.Text ?? NO_TEXT_AFK,
			Silent: Boolean(data.Silent),
			Started: data.Started ?? now,
			Status: data.Status ?? "afk",
		});

		AwayFromKeyboard.data.set(userData.ID, afk);

		AwayFromKeyboard.#activeGauge.inc(1);
		AwayFromKeyboard.#totalCounter.inc({
			type: afkData.Status
		});

		return afk;
	}
}

export default AwayFromKeyboard;
