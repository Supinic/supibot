import type { JSONifiable, Emote } from "../../@types/globals";
import type { Command, Parameter } from "../../@types/classes/command";
import type { Channel } from "../../@types/classes/channel";
import type { Platform } from "../../@types/platforms/template";
import type { User, Permissions as UserPermissions } from "../../@types/classes/user";

import type { Utils } from "supi-core/@types/types";
declare type UtilsSingleton = Utils.Utils;

// import * as Util from "util";

// This file is mostly meant to be used as a form of documentation for the $js
// command, and can also be used by more technical users to help them make
// advanced aliases.

// To use these types, you just need to add this repository as a dev dependency
// and import them, but this will not give you access to intellisense, to get
// intellisense make these definitions global to your project.

// To make these definitions global to your project:
//	Option a: Copy & Modify
// 		1)	Add the github repo 'supinic/supi-core' as a dev dependency.
//		2)	Copy this file to your project.
//		3)	Change the namespace from 'namespace DankDebug' to 'global' which will make all of these
//			declarations global to all files (if the file is included when compiling).
//	Option b: Install & Redeclare
// 		1)	Add the GitHub repo 'supinic/supibot' (this one) as a dev dependency.
//		2)	Make a new file, and redeclare all the variables you will need as global
//			(using `declare global { /* ... */ }`) with the types defined in this file.

export default DankDebug;
declare namespace DankDebug {
	/**
	 * The type of the global `utils` object.
	 */
	export interface SupibotDankDebugUtils {
		/**
		 * Returns the first emote from the list that is available from in the current context.
		 * If none of the emotes are available, the fallback is returned instead.
		 */
		getEmote(emotes: string[], fallback: string, options?: { caseSensitivity?: boolean }): Promise<string>,

		/**
		 * Returns a list of all emotes available for supibot to post in the current context.
		 */
		fetchEmotes(): Promise<Emote[]>,

		/**
		 * Returns the string with an invisible character inserted after the first character.
		 */
		unping(string: string): string;

		/**
		 * Takes a string value, and parses it according to the provided type.
		 * This is the underlying function used to parse parameters for all supibot commands.
		 */
		parseParameter: (value: string, type: Parameter.Type) => ReturnType<typeof Command.parseParameter>;

		/**
		 * Parses parameters from arguments in the same manner supibot does for commands.
		 * @param paramsDefinition The definitions of the parameters to parse
		 * @param argsArray The message to parse, split on a space.
		 */
		parseParametersFromArguments: typeof Command.parseParametersFromArguments;

		// These are all core.Utils methods:
		/**
		 * Capitalizes the string's first letter.
		 */
		capitalize: UtilsSingleton["capitalize"];

		/**
		 * Returns a random array element.
		 */
		randArray: UtilsSingleton["randArray"];

		/**
		 * Returns a random integer between min and max, inclusively.
		 */
		random: UtilsSingleton["random"];

		/**
		 * Creates a random string using the characters provided, or the base ASCII alphabet.
		 */
		randomString: UtilsSingleton["randomString"];

		/**
		 * Removes all (central European?) accents from a string.
		 */
		removeAccents: UtilsSingleton["removeAccents"];

		/**
		 * Creates a shallow copy of the array with elements shuffled around randomly.
		 */
		shuffleArray: UtilsSingleton["shuffleArray"];

		/**
		 * Returns a formatted string, specifying an amount of time delta from current date to provided date.
		 */
		timeDelta: UtilsSingleton["timeDelta"];

		/**
		 * Trims all redundant and duplicated whitespace from the provided string.
		 * Uses a tag-function syntax, and should be used with template strings directly.
		 */
		trim: UtilsSingleton["tag"]["trim"];

		/**
		 * Wraps the input string into the given amount of characters, discarding the rest.
		 */
		wrapString: UtilsSingleton["wrapString"];

		/**
		 * Pads a number with specified number of zeroes.
		 */
		zf: UtilsSingleton["zf"];

		/**
		 * Returns the best fit for given string, based on Levenshtein distance.
		 */
		selectClosestString: UtilsSingleton["selectClosestString"];
	}

	/** Supported primitive value types, used to construct the full value types later */
	export type SupibotStorePrimitive = string | number | boolean | null;

	/** A value that can be stored in a supibot store */
	export type SupibotStoreValue =
		{ [P: string]: SupibotStoreValue }
		| SupibotStoreValue[]
		| Map<SupibotStorePrimitive, SupibotStoreValue>
		| Set<SupibotStoreValue>;

	/** A place to store persistent data within supibot */
	export interface SupibotStore {
		set(key: string, value: SupibotStoreValue): void;
		get(key: string): SupibotStoreValue | undefined;
		getKeys(): string[];
	}

	export type QueryResult = {
		content: { category: string | null, status: string | null; }[];
		suscheck: string | null | undefined;
		ownAlias: { invocation: string, arguments: string[] } | null;
		randomSongRequest: { Name: string, Link: string, Video_Type: number }[];
		osrsClueTags: { ID: number, tier: string; type: string; description: string; hint: string; }[];
		randomSteamGames: { ID: number, name: string }[];
	};

	export type PartialCommandResult = {
		success: boolean;
		reply?: string | null;
		reason?: string | null;
	};

	export type SupibotDatabaseValue = string
		| number
		| boolean
		| null
		| bigint
		| Date
		| { [P: string]: SupibotStoreValue }
		| SupibotDatabaseValue[];

	export interface SupibotDankDebugQuery {
		/**
		 * Runs a predefined query based on its name, and returns the data in an array of objects, or an object, if determined so.
		 */
		run (string: string, ...args: string[]): Promise<SupibotDatabaseValue>;
		/**
		 * Retrieves meta data about currently active suggestions.
		 */
		run (string: "content"): Promise<QueryResult["content"]>;
		/**
		 * Retrieves the target user's Twitch ID, as is stored in Supibot's database (*NOT* the actual ID from Helix)
		 */
		run (string: "suscheck", username: string): Promise<QueryResult["suscheck"]>;
		/**
		 * Fetches the definition of an alias from the current user, based on the alias name provided.
		 */
		run (string: "ownAlias", name: string): Promise<QueryResult["ownAlias"]>;
	}

	export interface SupibotDankDebugCommand {
		execute (commandName: string, ...args: string[]): Promise<PartialCommandResult>;
		multi (input: Array<[commandName: string, ...args: string[]]>): Promise<PartialCommandResult[]>;
	}

	export interface SupibotPermissions {
		get (): UserPermissions.Value;
		is (level: UserPermissions.Level): boolean;
	}

	/**
	 * A list of aliases that are currently "in execution" for the current user. Similar to a call stack.
	 * The first element of the array is the "highest level" alias in the stack (the one the user typed).
	 * The last element is the name of the alias that started this $js invocation.
	 */
	export const aliasStack: string[];

	/**
	 * This variable is conditionally set based on how $js is invoked:
	 * Using the function parameter, this variable will be a string array of input passed to the $js command.
	 * Using the arguments parameter, this variable will be the JSON parsed form the value of the parameter (including primitives).
	 *
	 * In all other cases when neither the function parameter nor the arguments parameter is provided, the value is null.
	 */
	export const args: null | string[] | JSONifiable;

	/**
	 * The channel the command is being executed in.
	 * On discord, the channel is the string channel ID.
	 */
	export const channel: Channel["Name"] | null;

	/**
	 * The username of the user the command was executed by.
	 */
	export const executor: User["Name"];

	/**
	 * The internal user ID of the user the command was executed by.
	 */
	export const executorID: User["ID"];

	/**
	 * The platform the command is being executed in.
	 */
	export const platform: Platform["name"];

	/**
	 * Readonly access to the tee, see the help for `$abb tee`.
	 */
	export const tee: string[];

	/**
	 * Push an item to the tee.
	 */
	export const _teePush: (value: string) => void;

	/**
	 * A persistent key/value store tied to the current channel.
	 */
	export const channelCustomData: SupibotStore;

	/**
	 * A persistent key/value store tied to the current user.
	 */
	export const customData: SupibotStore;

	/**
	 * Collection of database-related methods.
	 */
	export const query: SupibotDankDebugQuery;

	/**
	 * Collection of database-related methods.
	 */
	export const request: {
		run: (requestName: string, ...args: any[]) => (
			{ success: false; statusCode: number | null }
			|
			{ success: true; data: object }
		);
	}

	/**
	 * Collection of user/channel permissions related methods.
	 */
	export const permissions: SupibotPermissions;

	/**
	 * Collection of subcommand execution-related methods.
	 */
	export const command: SupibotDankDebugCommand;

	/**
	 * Utils methods built into supibot.
	 */
	export const utils: SupibotDankDebugUtils;
}
