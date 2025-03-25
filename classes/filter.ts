import { SupiError } from "supi-core";
import { TemplateWithId } from "./template.js";

import { Channel, isChannel, privateMessageChannelSymbol } from "./channel.js";
import User from "./user.js";
import type Platform from "../platforms/template.js";
import type { Command } from "./command.js";
import type { XOR } from "../@types/globals.d.ts";

export type Type =
	"Blacklist" | "Whitelist" | "Opt-out" | "Block" | "Unping" | "Unmention" |
	"Cooldown" | "Flags" | "Offline-only" | "Online-only" | "Arguments" | "Reminder-prevention";

type CooldownData = XOR<{ multiplier: number }, { override: number, respect?: boolean }>;
export type DbArgumentDescriptor = {
	index?: number | string;
	range?: number[] | string[] | string;
	regex?: string | string[] | RegExp;
	string?: string;
};

type StringArgumentDescriptor = XOR<{ string: string; }, { regex: RegExp; }>;
type NumberArgumentDescriptor = XOR<{ index: number; }, { range: [number, number]; }>;
type ArgumentDescriptor = StringArgumentDescriptor & NumberArgumentDescriptor;

type ConstructorData = {
	ID: Filter["ID"];
	User_Alias: Filter["User_Alias"];
	Channel: Filter["Channel"];
	Command: Filter["Command"];
	Platform: Filter["Platform"];
	Invocation: Filter["Invocation"];
	Type: Filter["Type"];
	Response: Filter["Response"];
	Reason: Filter["Reason"];
	Blocked_User: Filter["Blocked_User"];
	Active: Filter["Active"];
	Issued_By: Filter["Issued_By"];
	Data: string | null;
};
export type CreateData = Partial<Omit<ConstructorData, "ID" | "Active">> & { Issued_By: number; };
type ReasonObject = {
	string: string;
	response: Filter["Response"];
	reason: Filter["Reason"]
};
type LocalsOptions = {
	channel?: Channel | symbol | null;
	user?: User | null;
	platform?: Platform | null;
	invocation?: Command["Name"] | null;
	command?: Command | Command["Name"] | null;
	skipUserCheck?: boolean;
};
type ExecuteOptions = Omit<LocalsOptions, "skipUserCheck"> & {
	user: User;
	command: Command;
	invocation?: Command["Name"] | null;
	targetUser?: string;
	args: string[];
};
type UnpingContextOptions = LocalsOptions & {
	string: string;
	executor: User | null;
};

type ExecuteFailureGeneral = {
	success: false,
	reason: string;
	reply: string | null;
	filter: Filter
};
type ExecuteFailureWhitelist = {
	success: false,
	reason: "whitelist",
	filter: { Reason: "Reply" },
	reply: string;
};
type ExecuteSuccess = {
	success: true;
};
export type ExecuteResult = ExecuteFailureGeneral | ExecuteFailureWhitelist | ExecuteSuccess;

export const isCooldownData = (input: Filter["Data"]): input is CooldownData => {
	if (!input || Array.isArray(input)) {
		return false;
	}

	return (typeof input.multiplier === "number" || typeof input.override === "number");
};
export const isArgumentsData = (input: Filter["Data"]): input is ArgumentDescriptor[] => {
	if (!input || !Array.isArray(input)) {
		return false;
	}

	return input.every(i => (
		(typeof i.string === "string" || i.regex instanceof RegExp)
		&& ((Array.isArray(i.range) && i.range.length === 2) || typeof i.index === "number")
	));
};

/**
 * Represents a filter of the bot's commands.
 */
export class Filter extends TemplateWithId {
	readonly ID: number;
	readonly User_Alias: User["ID"] | null;
	readonly Channel: Channel["ID"] | null;
	readonly Command: Command["Name"] | null;
	readonly Platform: Platform["ID"] | null;
	readonly Invocation: Command["Name"] | null;
	readonly Response: "None" | "Auto" | "Reason";
	readonly Reason: string | null;
	readonly Blocked_User: User["ID"] | null;
	readonly Issued_By: User["ID"];
	/**
	 * Filter type:
	 * - "Blacklist" disallows the usage for given combination of User_Alias/Channel/Command.
	 * - "Whitelist" disallows the usage of a command everywhere BUT the given combination of User_Alias/Channel.
	 * - "Opt-out" disallows the usage of given user as the parameter for given command.
	 * @todo documentation of all the other types
	 */
	readonly Type: Type;

	Active: boolean;
	/**
	 * Specific filter data |  usually only applicable to Cooldown and Arguments filter types.
	 */
	Data: CooldownData | ArgumentDescriptor[] | null;

	static data: Map<Filter["ID"], Filter> = new Map();
	static types: Record<Filter["Type"], Set<Filter>> = {
		Arguments: new Set(),
		Blacklist: new Set(),
		Block: new Set(),
		Cooldown: new Set(),
		Flags: new Set(),
		"Offline-only": new Set(),
		"Online-only": new Set(),
		"Opt-out": new Set(),
		"Reminder-prevention": new Set(),
		Unmention: new Set(),
		Whitelist: new Set(),
		Unping: new Set()
	};

	constructor (data: ConstructorData) {
		super();

		this.ID = data.ID;
		this.User_Alias = data.User_Alias;
		this.Channel = data.Channel;
		this.Command = data.Command;
		this.Platform = data.Platform;
		this.Invocation = data.Invocation;
		this.Type = data.Type;
		this.Response = data.Response;
		this.Reason = data.Reason;
		this.Blocked_User = data.Blocked_User;
		this.Active = data.Active;
		this.Issued_By = data.Issued_By;

		this.Data = this.createFilterData(data.Data);
	}

	/**
	 * For custom-data-related Filters, this method applies filter data to the provided data object.
	 * @returns Returned type depends on filter type - Args {boolean} or Cooldown {number}
	 */
	applyData (data: number | null): number | null;
	applyData (data: string[]): boolean;
	applyData (data: number | null | string[]): number | boolean | null {
		if (this.Type === "Arguments" && Array.isArray(data)) {
			const argsData = this.Data as ArgumentDescriptor[];
			for (const item of argsData) {
				const { index, range, regex, string } = item;
				for (let i = 0; i < data.length; i++) {
					const positionCheck = (typeof index === "number")
						? (i === index)
						: (range[0] <= i && i <= range[1]);

					const valueCheck = (typeof string === "string")
						? (data[i] === string)
						: regex.test(data[i]);

					if (positionCheck && valueCheck) {
						return true;
					}
				}
			}

			return false;
		}
		else if (this.Type === "Cooldown" && isCooldownData(this.Data) && (data === null || typeof data === "number")) {
			const value = data ?? 0; // `null` cooldowns are treated as zero
			const { multiplier, override, respect } = this.Data;

			if (typeof override === "number") {
				if (respect === false) {
					return override;
				}
				else {
					return Math.min(override, value);
				}
			}
			else if (typeof multiplier === "number") {
				if (data === null) {
					return data;
				}

				return Math.round(value * multiplier);
			}
		}

		throw new SupiError({
			message: "Invalid combination of input data and filter type",
			args: {
				filterType: this.Type,
				inputData: data
			}
		});
	}

	/* eslint-disable no-bitwise */
	get priority () {
		let priority = 0;
		if (this.Platform) {
			priority |= 0b0000_0001;
		}
		if (this.Channel) {
			priority |= 0b0000_0010;
		}
		if (this.Command) {
			priority |= 0b0000_0100;
		}
		if (this.Invocation) {
			priority |= 0b0000_1000;
		}
		if (this.User_Alias) {
			priority |= 0b0001_0000;
		}

		return priority;
	}
	/* eslint-enable no-bitwise */

	createFilterData (rawData: string | null): ArgumentDescriptor[] | CooldownData | null {
		if (!rawData) {
			return null;
		}

		let data: Record<string, unknown>;
		try {
			data = JSON.parse(rawData) as Record<string, unknown>;
		}
		catch {
			return null;
		}

		if (this.Type === "Arguments") {
			const { args } = data as { args?: DbArgumentDescriptor[] };
			if (!args) {
				console.warn("Invalid Args filter - missing args object");
				return null;
			}

			const result: ArgumentDescriptor[] = [];
			for (const arg of args) {
				const obj: ArgumentDescriptor = {} as ArgumentDescriptor;
				if (arg.regex) {
					if (arg.regex instanceof RegExp) {
						obj.regex = arg.regex;
					}
					else if (Array.isArray(arg.regex)) {
						obj.regex = new RegExp(arg.regex[0], arg.regex[1] ?? "");
					}
					else {
						const string = arg.regex.replaceAll(/^\/|\/$/g, "");
						const lastSlashIndex = string.lastIndexOf("/");

						const regexBody = (lastSlashIndex !== -1) ? string.slice(0, lastSlashIndex) : string;
						const flags = (lastSlashIndex !== -1) ? string.slice(lastSlashIndex + 1) : "";

						try {
							obj.regex = new RegExp(regexBody, flags);
						}
						catch (e) {
							console.warn("Invalid string regex representation", e);
							continue;
						}
					}
				}
				else if (arg.string) {
					obj.string = arg.string;
				}
				else {
					console.warn("Invalid filter Args item - type", { arg, filter: this.ID });
					continue;
				}

				if (typeof arg.index === "number") {
					obj.index = arg.index;
				}
				else if (Array.isArray(arg.range)) {
					const [first, second] = [...arg.range].slice(0, 2).map(Number);
					obj.range = [first, second];
				}
				else if (typeof arg.range === "string") {
					const [first, second] = arg.range.split("..").map(Number).slice(0, 2);
					obj.range = [first, second];
				}

				if (obj.range && Array.isArray(obj.range)) {
					// `Infinity` is allowed specifically because it matches the <x, ..> range identifier
					const allowed = obj.range.every(i => sb.Utils.isValidInteger(i) || i === Infinity);
					if (!allowed) {
						console.warn("Invalid numbers provided for filter Args range", { arg, filter: this.ID });
						continue;
					}
				}

				result.push(obj);
			}

			return result;
		}
		else if (this.Type === "Cooldown") {
			const { multiplier, override, respect } = data as Partial<CooldownData>;
			if (typeof multiplier === "number" && typeof override === "undefined") {
				return { multiplier };
			}
			else if (typeof multiplier === "undefined" && typeof override === "number") {
				return { override, respect };
			}
			else {
				console.warn("Invalid Cooldown filter - incorrect combination of multiplier/override", {
					multiplier,
					override
				});
			}
		}

		return null;
	}

	async toggle () {
		this.Active = !this.Active;
		const row = await sb.Query.getRow<ConstructorData>("chat_data", "Filter");
		await row.load(this.ID);

		row.values.Active = this.Active;
		await row.save();
	}

	async saveProperty (property: keyof this, value?: this[keyof Filter]) {
		const row = await sb.Query.getRow<ConstructorData>("chat_data", "Filter");
		await row.load(this.ID);

		await super.saveRowProperty(row, property, value, this);

		if (property === "Data") {
			this.Data = this.createFilterData(row.values.Data as string);
		}
	}

	destroy () {}

	getCacheKey (): never {
		throw new SupiError({
			message: "Filter module does not support `getCacheKey`"
		});
	}

	static async loadData () {
		const data = await sb.Query.getRecordset<ConstructorData[]>(rs => rs
			.select("*")
			.from("chat_data", "Filter")
		);

		for (const definition of data) {
			const instance = new Filter(definition);
			Filter.data.set(instance.ID, instance);
		}
	}

	static get (identifier: Filter): Filter;
	static get (identifier: Filter["ID"]): Filter | null;
	static get (identifier: Filter | Filter["ID"]) {
		if (identifier instanceof Filter) {
			return identifier;
		}
		else {
			return Filter.data.get(identifier) ?? null;
		}
	}

	static getLocals (type: Filter["Type"] | "all", options: LocalsOptions) {
		const result: Filter[] = [];
		const set: Iterable<Filter> = (type === "all")
			? Filter.data.values()
			: Filter.types[type];

		const { channel, user, invocation = null, platform, command = null } = options;
		const channelId = (isChannel(channel)) ? channel.ID : null;
		const userId = user?.ID ?? null;
		const platformId = platform?.ID ?? null;
		const commandName = (typeof command === "string")
			? command
			: command?.Name ?? null;

		for (const filter of set) {
			if (!filter.Active) {
				continue;
			}
			else if (!options.skipUserCheck && filter.User_Alias === userId) {
				continue;
			}
			else if (filter.Channel !== channelId) {
				continue;
			}
			else if (filter.Platform !== platformId) {
				continue;
			}
			else if (filter.Invocation !== invocation) {
				continue;
			}
			else if (filter.Command !== commandName) {
				continue;
			}

			result.push(filter);
		}

		return result;
	}

	/**
	 * Executes all possible filters for the incoming combination of parameters
	 */
	static async execute (options: ExecuteOptions): Promise<ExecuteResult> {
		const { command, targetUser, user } = options;
		if (await user.getDataProperty("administrator")) {
			return { success: true };
		}

		let userTo: User | null = null;
		const channel = options.channel ?? privateMessageChannelSymbol;
		const localFilters = Filter.getLocals("all", {
			...options,
			skipUserCheck: true
		});

		if (command.Flags.includes("whitelist")) {
			const whitelist = localFilters.find((
				i => i.Type === "Whitelist"
				&& (i.User_Alias === user.ID || i.User_Alias === null)
			));

			if (!whitelist) {
				return {
					success: false,
					reason: "whitelist",
					filter: { Reason: "Reply" },
					reply: command.Whitelist_Response ?? "You can't use this command as it is whitelisted!"
				};
			}
		}

		const argumentFilter = localFilters.find(i => i.Type === "Arguments" && i.applyData(options.args));
		if (argumentFilter) {
			const targetType = (argumentFilter.Invocation) ? "command invocation" : "command";
			const targetAmount = (argumentFilter.Command) ? "this" : "any";

			return {
				success: false,
				reason: "arguments",
				filter: argumentFilter,
				reply: Filter.getReason({
					reason: argumentFilter.Reason,
					response: argumentFilter.Response,
					string: `You cannot use this argument on this position for ${targetAmount} ${targetType}!`
				})
			};
		}

		if ((command.Flags.includes("optOut") || command.Flags.includes("block")) && targetUser) {
			userTo = await User.get(targetUser);
		}

		if (command.Flags.includes("optOut") && userTo) {
			const optout = localFilters.find(i => i.Type === "Opt-out"
				&& i.User_Alias === userTo.ID
			);

			if (optout) {
				const targetType = (optout.Invocation) ? "command invocation" : "command";
				const targetAmount = (optout.Command) ? "this" : "every";

				let string;
				if (user.ID === optout.User_Alias) {
					string = `🚫 You have opted out from being the target of ${targetAmount} ${targetType}! This includes yourself! 😅`;
				}
				else {
					string = `🚫 That user has opted out from being the target of ${targetAmount} ${targetType}!`;
				}

				return {
					success: false,
					reason: "opt-out",
					filter: optout,
					reply: Filter.getReason({
						reason: optout.Reason,
						response: optout.Response,
						string
					})
				};
			}
		}

		if (command.Flags.includes("block") && userTo) {
			const userFrom = user;
			const block = localFilters.find(i => (
				i.Type === "Block"
				&& i.User_Alias === userTo.ID
				&& (i.Blocked_User === userFrom.ID || i.Blocked_User === null)
			));

			if (block) {
				const targetType = (block.Invocation) ? "command invocation" : "command";
				const targetAmount = (block.Command) ? "this" : "every";

				return {
					success: false,
					reason: "block",
					filter: block,
					reply: Filter.getReason({
						reason: block.Reason,
						response: block.Response,
						string: `🚫 That user has blocked you from being the target of ${targetAmount} ${targetType}!`
					})
				};
			}
		}

		const blacklist = localFilters.find(i => (
			i.Type === "Blacklist"
			&& (i.User_Alias === user.ID || i.User_Alias === null)
		));

		if (blacklist) {
			let reply = null;
			if (blacklist.Response === "Reason") {
				reply = blacklist.Reason;
			}
			else if (blacklist.Response === "Auto") {
				if (blacklist.Channel && blacklist.User_Alias && blacklist.Command && blacklist.Invocation) {
					reply = "You cannot execute this command invocation in this channel.";
				}
				else if (blacklist.Channel && blacklist.User_Alias && blacklist.Command) {
					reply = "You cannot execute this command in this channel.";
				}
				else if (blacklist.Channel && blacklist.Command) {
					reply = "This command cannot be executed in this channel.";
				}
				else if (blacklist.Channel && blacklist.User_Alias) {
					reply = "You cannot execute any commands in this channel.";
				}
				else if (blacklist.User_Alias && blacklist.Command && blacklist.Invocation) {
					reply = "You cannot execute this command invocation in any channel.";
				}
				else if (blacklist.User_Alias && blacklist.Command) {
					reply = "You cannot execute this command in any channel.";
				}
				else if (blacklist.User_Alias) {
					reply = "You cannot execute any commands in any channel.";
				}
				else if (blacklist.Command && blacklist.Invocation) {
					reply = "This command invocation cannot be executed anywhere.";
				}
				else if (blacklist.Command) {
					reply = "This command cannot be executed anywhere.";
				}
				else if (blacklist.Channel) {
					reply = "No commands can be executed in this channel.";
				}
				else {
					throw new SupiError({
						message: "Unrecognized filter configuration",
						args: { ID: blacklist.ID }
					});
				}
			}

			return {
				success: false,
				reason: "blacklist",
				filter: blacklist,
				reply
			};
		}

		let channelLive: boolean | null = null;
		if (isChannel(channel)) {
			channelLive = await channel.isLive();
		}

		const offlineOnly = localFilters.find(i => i.Type === "Offline-only" && (i.User_Alias === user.ID || i.User_Alias === null));
		if (offlineOnly && channelLive === true) {
			const targetType = (offlineOnly.Invocation) ? "command invocation" : "command";
			return {
				success: false,
				reason: "offline-only",
				filter: offlineOnly,
				reply: Filter.getReason({
					reason: offlineOnly.Reason,
					response: offlineOnly.Response,
					string: `🚫 This ${targetType} is only available when the channel is offline!`
				})
			};
		}

		const onlineOnly = localFilters.find(i => i.Type === "Online-only" && (i.User_Alias === user.ID || i.User_Alias === null));
		if (onlineOnly && channelLive === false) {
			const targetType = (onlineOnly.Invocation) ? "command invocation" : "command";
			return {
				success: false,
				reason: "online-only",
				filter: onlineOnly,
				reply: Filter.getReason({
					reason: onlineOnly.Reason,
					response: onlineOnly.Response,
					string: `🚫 This ${targetType} is only available when the channel is online!`
				})
			};
		}

		return { success: true };
	}

	static async create (options: CreateData) {
		const data = {
			Platform: options.Platform ?? null,
			Channel: options.Channel ?? null,
			Command: options.Command ?? null,
			User_Alias: options.User_Alias ?? null,
			Invocation: options.Invocation ?? null,
			Data: options.Data ?? null,
			Type: options.Type ?? "Blacklist",
			Response: options.Response ?? "Auto",
			Reason: options.Reason ?? null,
			Blocked_User: options.Blocked_User ?? null,
			Active: true,
			Issued_By: options.Issued_By
		};

		const row = await sb.Query.getRow<ConstructorData>("chat_data", "Filter");
		row.setValues(data);
		await row.save();

		const filter = new Filter({
			...data,
			ID: row.values.ID
		});

		Filter.data.set(filter.ID, filter);
		return filter;
	}

	static getMentionStatus (options: Partial<ExecuteOptions>) {
		const filters = Filter.getLocals("Unmention", {
			...options,
			channel: options.channel ?? privateMessageChannelSymbol
		});

		return (filters.length === 0);
	}

	/**
	 * Executes an unping process on a given string for a given command.
	 * For each user that has decided to "unping" from a given command, their name will be replaced by a string
	 * where on the second position a zero-width character is inserted. This makes sure that they won't be so-called
	 * "pinged", aka notified based on a regex.
	 */
	static async applyUnping (options: UnpingContextOptions) {
		const rawFilters = Filter.getLocals("Unping", {
			...options,
			skipUserCheck: true
		});

		// Either the filter doesn't care about who is executing the command,
		// or the executing user isn't passed,
		// or the filter has to match the executor precisely.
		const filters = rawFilters.filter(i => (
			(i.Blocked_User === null || options.executor === null || i.Blocked_User === options.executor.ID)
		));

		let { string } = options;
		const userIds = filters.map(i => i.User_Alias).filter(Boolean) as number[]; // Known because of filter(Boolean)
		const unpingUsers = await User.getMultiple(userIds);

		for (const user of unpingUsers) {
			// Only unping usernames if they are not followed by a specific set of characters.
			// This refers to "." and "@" - these are usually parts of URLs or e-mail addresses.
			const regex = new RegExp(`(?<![\\/=])\\b(${user.Name})(?![.@]\\w+)`, "gi");
			string = string.replace(regex, (name: string) => `${name[0]}\u{E0000}${name.slice(1)}`);
		}

		return string;
	}

	static getCooldownModifiers (options: LocalsOptions) {
		const filters = Filter.getLocals("Cooldown", options).sort((a, b) => b.priority - a.priority);
		return filters[0] ?? null;
	}

	static getFlags (options: LocalsOptions) {
		const flags = {};
		const flagData = Filter.getLocals("Flags", options).sort((a, b) => a.priority - b.priority);

		for (const flag of flagData) {
			Object.assign(flags, flag.Data);
		}

		return flags;
	}

	static getReminderPreventions (options: LocalsOptions) {
		const filters = Filter.getLocals("Reminder-prevention", {
			...options,
			skipUserCheck: true
		});

		return filters.map(i => i.User_Alias);
	}

	/**
	 * Picks the correct response string, based on the type provided
	 */
	static getReason (options: ReasonObject) {
		const { string, response, reason } = options;
		if (response === "Auto") {
			return string;
		}
		else if (response === "Reason") {
			return reason ?? null;
		}
		else {
			return null;
		}
	}

	static async reloadSpecific (...list: Filter["ID"][]) {
		if (list.length === 0) {
			return false;
		}

		const promises = list.map(async (ID) => {
			const row = await sb.Query.getRow<ConstructorData>("chat_data", "Filter");
			await row.load(ID);

			const existingFilter = Filter.data.get(ID);
			if (existingFilter) {
				existingFilter.destroy();
				Filter.data.delete(ID);
			}

			if (!row.values.Active) {
				return;
			}

			const newFilter = new Filter(row.valuesObject);
			Filter.data.set(ID, newFilter);
		});

		await Promise.all(promises);
		return true;
	}
}

export default Filter;
