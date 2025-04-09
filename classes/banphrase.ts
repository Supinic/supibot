import { TemplateWithId } from "./template.js";
import type { Channel } from "./channel.js";
import type Platform from "../platforms/template.js";

import config from "../config.json" with { type: "json" };
import regexes from "../utils/regexes.js";
import { isGotRequestError, SupiError, type RecordUpdater } from "supi-core";
import { transliterate as executeTransliteration } from "transliteration";

const { responses, values } = config;
const apiDataSymbol: unique symbol = Symbol("banphrase-api-data");
const apiResultSymbol: unique symbol = Symbol("banphrase-api-result");
const inactiveSymbol: unique symbol = Symbol("banphrase-inactive");

const banphraseConfigData = {
	massPingBanphraseThreshold: values.massPingBanphraseThreshold,
	transliterate: (input: string) => executeTransliteration(input),
	...regexes
} as const;

export type Type = "Denial" | "API response" | "Custom response" | "Replacement" | "Inactive";
type ConstructorData = {
	ID: Banphrase["ID"];
	Type: Banphrase["Type"];
	Platform: Banphrase["Platform"];
	Channel: Banphrase["Channel"];
	Active?: boolean;
	Code: string;
};

type PajbotSuccess = {
	banned: false;
	input_message: string;
};
type PajbotFailure = {
	banned: true;
	banphrase_data: {
		case_sensitive: boolean;
		id: number;
		length: number;
		name: string;
		operator: string;
		permanent: boolean;
		phrase: string;
		remove_accents: boolean;
		sub_immunity: boolean;
	};
};
type PajbotResponse = PajbotFailure | PajbotSuccess;

type ExternalApiResponse = PajbotResponse & {
	[apiResultSymbol]: boolean;
	[apiDataSymbol]: Record<string, string | number | boolean | null> | undefined;
};
type ExecuteOptions = {
	skipBanphraseAPI?: boolean;
};
type BanphraseExecuteSuccess = {
	passed: true;
	string: string;
	warn?: boolean;
	privateMessage?: boolean;
};
type BanphraseExecuteFailure = {
	passed: false;
	string: string | null;
	warn?: boolean;
};
type BanphraseExecuteResult = BanphraseExecuteFailure | BanphraseExecuteSuccess;

type BanphraseApiDenialLog = {
	Channel: Channel["ID"];
	Platform: Platform["ID"];
	API: NonNullable<Channel["Banphrase_API_URL"]>;
	Message: string,
	Response: string;
};

type ExternalExecuteOptions = {
	fullResponse?: boolean;
};
type ExternalApiType = "Pajbot";

type ReplacementFunction = (message: string, configData?: typeof banphraseConfigData) => string | Promise<string>;
type CustomResponseFunction = (message: string, configData?: typeof banphraseConfigData) => string | null | Promise<string | null>;
type BanphraseCodeFunction = ReplacementFunction | CustomResponseFunction;

const isBanphraseFunction = (input: unknown): input is Banphrase["Code"] => (typeof input === "function");

const ExternalBanphraseAPI = {
	async pajbot (message: string, url: string) {
		message = message.trim().replaceAll(/\s+/g, " ");

		const response = await core.Got.get("GenericAPI")<PajbotResponse>({
			method: "POST",
			url: `https://${url}/api/v1/banphrases/test`,
			json: { message },
			timeout: {
				request: values.pajbotBanphraseRequestTimeout
			},
			retry: {
				limit: 1
			}
		});

		if (!response.ok) {
			throw new SupiError({
				message: "Cannot check for banphrases",
				args: { message, url }
			});
		}

		const { body } = response;
		const data: ExternalApiResponse = {
			...body,
			[apiResultSymbol]: Boolean(body.banned ? body.banphrase_data.phrase : false),
			[apiDataSymbol]: (body.banned) ? body.banphrase_data : undefined
		};

		return data;
	}
};

export class Banphrase extends TemplateWithId {
	readonly ID: number;
	readonly Type: Type;
	readonly Platform: Platform["ID"] | null = null;
	readonly Channel: Channel["ID"] | null = null;
	readonly Code: BanphraseCodeFunction;
	Active: boolean;
	data = {};

	static readonly importable = true;
	static readonly data: Map<Banphrase["ID"], Banphrase> = new Map();

	constructor (data: ConstructorData) {
		super();

		this.ID = data.ID;
		this.Type = data.Type;
		this.Active = data.Active ?? true;
		this.Platform = data.Platform;
		this.Channel = data.Channel;

		const code: unknown = eval(data.Code);
		if (!isBanphraseFunction(code)) {
			throw new SupiError({
				message: "Invalid function definition passed to Banphrase",
				args: {
					ID: this.ID,
					type: typeof code
				}
			});
		}

		this.Code = code;
	}

	async execute (message: string): Promise<string | null | typeof inactiveSymbol> {
		if (!this.Active) {
			return inactiveSymbol;
		}

		try {
			return await this.Code(message, banphraseConfigData);
		}
		catch (e) {
			console.warn("banphrase failed", message, this, e);
			return message;
		}
	}

	destroy () {}

	getCacheKey (): never {
		throw new SupiError({
			message: "Banphrase module does not support `getCacheKey`"
		});
	}

	async toggle () {
		this.Active = !this.Active;
		await core.Query.getRecordUpdater((ru: RecordUpdater) => ru
			.update("chat_data", "Banphrase")
			.set("Active", this.Active)
			.where("ID = %n", this.ID)
		);
	}

	static async loadData () {
		const data = await core.Query.getRecordset<ConstructorData[]>(rs => rs
			.select("Banphrase.*")
			.from("chat_data", "Banphrase")
			.where("Type <> %s", "Inactive")
			.orderBy("Priority DESC")
		);

		for (const record of data) {
			const banphrase = new Banphrase(record);
			Banphrase.data.set(banphrase.ID, banphrase);
		}
	}

	static async reloadSpecific (...list: Banphrase["ID"][]): Promise<boolean> {
		if (list.length === 0) {
			return false;
		}

		const promises = list.map(async (ID) => {
			const row = await core.Query.getRow<ConstructorData>("chat_data", "Banphrase");
			await row.load(ID);

			const existing = Banphrase.data.get(ID);
			if (existing) {
				existing.destroy();
				Banphrase.data.delete(ID);
			}

			if (!row.values.Active) {
				return;
			}

			const banphrase = new Banphrase(row.valuesObject);
			Banphrase.data.set(banphrase.ID, banphrase);
		});

		await Promise.all(promises);
		return true;
	}

	static get (identifier: Banphrase | Banphrase["ID"]) {
		if (identifier instanceof Banphrase) {
			return identifier;
		}
		else {
			const result = Banphrase.data.get(identifier);
			return result ?? null;
		}
	}

	static async execute (message: string, channelData: Channel | null, options: ExecuteOptions = {}): Promise<BanphraseExecuteResult> {
		let resultMessage = message;
		const channelId = channelData?.ID ?? null;
		const platformId = channelData?.Platform.ID ?? null;

		for (const banphrase of Banphrase.data.values()) {
			if (!banphrase.Active) {
				continue;
			}
			else if (banphrase.Type === "API response") {
				continue;
			}
			else if (banphrase.Channel !== channelId || banphrase.Platform !== platformId) {
				continue;
			}

			const result = await banphrase.execute(resultMessage);
			if (result === inactiveSymbol) {
				continue;
			}

			if (typeof result !== "undefined") {
				// Return immediately if the message was deemed to be ignored, or responded to with a custom response
				if (banphrase.Type !== "Replacement") {
					return {
						string: result || null,
						passed: false
					};
				}
				// Otherwise, keep replacing the banphrases in a message
				else {
					if (typeof result !== "string") {
						throw new SupiError({
							message: "Assert error: Non-string result of a Replacement Banphrase",
							args: { result }
						});
					}
					resultMessage = result;
				}
			}
		}

		if (options.skipBanphraseAPI || !channelData?.Banphrase_API_Type) {
			return {
				string: message,
				passed: true
			};
		}

		// If the channel has a banphrase API, check it afterwards
		// Skip this check if it has been requested to be skipped
		let isExternallyBanphrased: boolean | null = null;
		try {
			const responseData = await Banphrase.executeExternalAPI(
				message.slice(0, 1000),
				channelData.Banphrase_API_Type,
				channelData.Banphrase_API_URL,
				{ fullResponse: true }
			);

			isExternallyBanphrased = responseData[apiResultSymbol];

			if (isExternallyBanphrased) { // @todo platform-specific logging flag
				const row = await core.Query.getRow<BanphraseApiDenialLog>("chat_data", "Banphrase_API_Denial_Log");
				row.setValues({
					API: channelData.Banphrase_API_URL,
					Channel: channelData.ID,
					Platform: channelData.Platform.ID,
					Message: message,
					Response: JSON.stringify(responseData[apiDataSymbol])
				});

				await row.save();
			}
		}
		catch (e) {
			if (!isGotRequestError(e)) {
				throw e;
			}

			await sb.Logger.log(
				"System.Warning",
				`Banphrase API fail - code: ${e.code}, message: ${e.message}`,
				channelData
			);

			switch (channelData.Banphrase_API_Downtime) {
				case "Ignore":
					return {
						string: message,
						passed: true,
						warn: true
					};

				case "Notify":
					return {
						string: `⚠ ${message}`,
						passed: true,
						warn: true
					};

				case "Nothing":
					return {
						string: null,
						passed: false,
						warn: false
					};

				case "Refuse": {
					let string;
					if (e.code === "ETIMEDOUT") {
						string = `Cannot reply - banphrase API timed out.`;
					}
					else if (e.code === "HTTPError") {
						const match = e.message.match(/Response code (\d+)/);
						const statusString = (match)
							? `(status code ${match[1]})`
							: "";

						string = `Cannot reply - banphrase API is currently down. ${statusString}`;
					}
					else {
						string = `Cannot reply - banphrase API encountered an unexpected error.`;
					}

					return {
						string,
						passed: false
					};
				}

				case "Whisper": {
					return {
						string: `Banphrase failed, your command result: ${message}.`,
						passed: true,
						privateMessage: true,
						warn: true
					};
				}
			}
		}

		// If the message is banphrased, check for API responses and return one accordingly.
		// If not found, return a default one.
		if (isExternallyBanphrased) {
			for (const banphrase of Banphrase.data.values()) {
				if (banphrase.Type !== "API response") {
					continue;
				}
				else if (banphrase.Channel !== channelId) {
					continue;
				}

				const result = await banphrase.execute(message);
				if (typeof result === "string") {
					return {
						string: result,
						passed: false
					};
				}
			}

			return {
				string: responses.defaultBanphrase,
				passed: false
			};
		}

		return {
			string: resultMessage,
			passed: true
		};
	}

	static async executeExternalAPI (message: string, type: ExternalApiType, url: string, options: { fullResponse: true; }): Promise<ExternalApiResponse>;
	static async executeExternalAPI (message: string, type: ExternalApiType, url: string, options?: { fullResponse?: false; }): Promise<false | string>;
	static async executeExternalAPI (
		message: string,
		type: ExternalApiType,
		url: string,
		options: ExternalExecuteOptions = {}
	): Promise<string | false | ExternalApiResponse> {
		let result: ExternalApiResponse | null = null;
		// Likely unnecessary, since Pajbot is the only API type supported. But, could still be extended in the future.
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (type === "Pajbot") {
			result = await ExternalBanphraseAPI.pajbot(message, url);
		}

		if (!result) {
			throw new SupiError({
				message: "Invalid external API type of response",
				args: { message, type, url }
			});
		}

		if (options.fullResponse) {
			return result;
		}
		else {
			return (result.banned) ? result.banphrase_data.phrase : false;
		}
	}
}

export default Banphrase;
