const ALLOWED_PARAMETER_TYPES = new Set(["string", "number", "boolean", "date", "object", "regex"]);
const allowedUtilsMethods = [
	"capitalize",
	"randArray",
	"random",
	"randomString",
	"removeAccents",
	"selectClosestString",
	"shuffleArray",
	"timeDelta",
	"wrapString",
	"zf"
];

const advancedStringify = (data) => JSON.stringify(data, (key, value) => {
	if (value instanceof Map) {
		return {
			"@objectRepresentation": "Map",
			entries: [...value.entries()]
		};
	}
	else if (value instanceof Set) {
		return {
			"@objectRepresentation": "Set",
			values: [...value.values()]
		};
	}
	else {
		return value;
	}
});

const advancedParse = (string) => JSON.parse(string, (key, value) => {
	if (typeof value === "object" && value !== null) {
		if (value["@objectRepresentation"] === "Map" && Array.isArray(value.entries)) {
			try {
				return new Map(value.entries);
			}
			catch {
				return new Map();
			}
		}
		else if (value["@objectRepresentation"] === "Set" && Array.isArray(value.values)) {
			try {
				return new Set(value.values);
			}
			catch {
				return new Set();
			}
		}
		else if (Object.getPrototypeOf(value) === Object.prototype) {
			const obj = Object.create(null);
			for (const [subKey, subValue] of Object.entries(value)) {
				obj[subKey] = subValue;
			}

			return obj;
		}
	}

	return value;
});

const SUPPORTED_PRIMITIVE_TYPES = new Set(["number", "string", "boolean"]);
const SUPPORTED_PROTOTYPES = new Set([Array.prototype, Object.prototype, null, Map.prototype, Set.prototype]);

const isTypeSupported = (value) => {
	const type = typeof value;
	const prototype = (value) ? Object.getPrototypeOf(value) : undefined;
	if (value && SUPPORTED_PROTOTYPES.has(prototype)) {
		let validObjectProperties = true;
		const entries = (prototype === Map.prototype || prototype === Set.prototype)
			? [...value.entries()]
			: Object.entries(value);

		for (const [propertyKey, propertyValue] of entries) {
			validObjectProperties &&= isTypeSupported(propertyKey);
			validObjectProperties &&= isTypeSupported(propertyValue);
		}

		return validObjectProperties;
	}

	return (
		value === null
		|| value === undefined
		|| SUPPORTED_PRIMITIVE_TYPES.has(type)
	);
};

const predefinedQueries = {
	content: () => core.Query.getRecordset(rs => rs
		.select("Category AS category", "Status AS status")
		.from("data", "Suggestion")
		.where("Status IS NULL OR Status IN %s+", ["Approved", "Blocked"])
	),
	suscheck: (context, username) => core.Query.getRecordset(rs => rs
		.select("Twitch_ID")
		.from("chat_data", "User_Alias")
		.where("Name = %s", username)
		.flat("Twitch_ID")
		.single()
		.limit(1)
	),
	ownAlias: async (context, name) => {
		const raw = await core.Query.getRecordset(rs => rs
			.select("Invocation", "Arguments")
			.from("data", "Custom_Command_Alias")
			.where("Name = %s", name)
			.where("User_Alias = %n", context.user.ID)
			.where("Channel IS NULL")
			.where("Parent IS NULL")
			.single()
			.limit(1)
		);

		if (!raw) {
			return null;
		}

		return {
			invocation: raw.Invocation,
			arguments: (raw.Arguments)
				? JSON.parse(raw.Arguments)
				: []
		};
	},
	randomSongRequest: () => core.Query.getRecordset(rs => rs
		.select("Name", "Link", "Video_Type")
		.from("chat_data", "Song_Request")
		.where("Video_Type IN %n+", [1])
		.orderBy("RAND() DESC")
		.limit(1)
		.single()
	),
	osrsClueTags: () => core.Query.getRecordset(rs => rs
		.select("ID", "Tier as tier", "Type as type", "Description as description", "Hint as hint")
		.from("personal", "Clue_Scroll_Tag")
		.where("Tier NOT IN %s+", ["Beginner", "Master"])
		.orderBy("Hint ASC", "ID ASC")
	),
	randomSteamGames: () => core.Query.getRecordset(rs => rs
		.select("ID", "Name AS name")
		.from("data", "Steam_Game")
		.orderBy("RAND()")
		.limit(10)
	)
};
const predefinedRequests = {
	olympics2024: async () => {
		const response = await core.Got.get("GenericAPI")({
			url: "https://api.olympics.kevle.xyz/medals",
			throwHttpErrors: false
		});

		if (!response.ok) {
			return {
				success: false,
				statusCode: response.statusCode
			};
		}

		return {
			success: true,
			data: response.body
		};
	}
};

const RESTRICTED_COMMAND_NAMES = new Set(["alias", "pipe", "dankdebug"]);
const commandExecutionCountThreshold = 5;

export default async function createDebugSandbox (context, scriptArgs) {
	const rawCustomUserData = await context.user.getDataProperty("customDeveloperData") ?? {};
	const customUserData = advancedParse(JSON.stringify(rawCustomUserData));

	const rawCustomChannelData = await context.channel?.getDataProperty("sharedCustomData") ?? {};
	const customChannelData = (context.channel)
		? advancedParse(JSON.stringify(rawCustomChannelData))
		: null;

	const userPermissions = await context.getUserPermissions();

	const queryExecutions = new Set();
	const requestExecutions = new Set();
	let userDataChanged = false;
	let channelDataChanged = false;
	let commandExecutionCounter = 0;
	let commandExecutionPending = false;

	// When editing the sandbox context, make sure to update the type definitions in ./sandbox.d.ts
	const sandbox = {
		console: undefined,
		aliasStack: (context.append.aliasStack)
			? [...context.append.aliasStack]
			: [],
		args: scriptArgs ?? null,
		channel: context.channel?.Name ?? "(none)",
		executor: context.user.Name,
		executorID: context.user.ID,
		platform: context.platform.Name,
		permissions: core.Utils.deepFreeze({
			get: () => userPermissions.flag,
			is: (level) => {
				if (!Object.hasOwn(sb.User.permissions, level)) {
					throw new Error("Unknown permission level provided");
				}

				return userPermissions.is(level);
			}
		}),
		query: core.Utils.deepFreeze({
			run: async (queryName, ...args) => {
				if (!queryName) {
					throw new Error("Query name must be provided");
				}
				else if (typeof queryName !== "string") {
					throw new Error("Query name must be provided as a string");
				}
				else if (queryExecutions.has(queryName)) {
					throw new Error("This query has already been executed in this command before");
				}

				const callback = predefinedQueries[queryName];
				if (!callback) {
					throw new Error("Predefined query not found");
				}
				else if (args.length > 0 && (callback.length - 1) !== args.length) {
					throw new Error("Amount of arguments provided doesn't match the query function signature");
				}

				queryExecutions.add(queryName);
				const data = await callback(context, ...args);

				if (Array.isArray(data)) {
					for (let i = 0; i < data.length; i++) {
						const row = data[i];
						if (row && typeof row === "object") {
							for (const [key, value] of Object.entries(row)) {
								if (value instanceof sb.Date) {
									row[key] = new Date(Number(value));
								}
							}
						}
						else if (row instanceof sb.Date) {
							data[i] = new Date(Number(data[i]));
						}
					}
				}
				else if (data && typeof data === "object") {
					for (const [key, value] of Object.entries(data)) {
						if (value instanceof sb.Date) {
							data[key] = new Date(Number(value));
						}
					}
				}

				return data;
			}
		}),
		request: core.Utils.deepFreeze({
			run: async (requestName, ...args) => {
				if (!requestName) {
					throw new Error("Request name must be provided");
				}
				else if (typeof requestName !== "string") {
					throw new Error("Request name must be provided as a string");
				}
				else if (requestExecutions.has(requestName)) {
					throw new Error("This request has already been executed in this command before");
				}

				const callback = predefinedRequests[requestName];
				if (!callback) {
					throw new Error("Predefined request not found");
				}
				else if (args.length > 0 && (callback.length - 1) !== args.length) {
					throw new Error("Amount of arguments provided doesn't match the request function signature");
				}

				requestExecutions.add(requestName);
				return await callback(context, ...args);
			}
		}),
		command: core.Utils.deepFreeze({
			multi: async function (input) {
				if (!Array.isArray(input) || input.some(i => !Array.isArray(i) || i.some(j => typeof j !== "string"))) {
					throw new Error("Provided input must be an array of arrays - each being the name and arguments for one command");
				}
				else if (commandExecutionPending) {
					throw new Error("A command execution is already pending in this invocation");
				}
				else if ((commandExecutionCounter + input.length) > commandExecutionCountThreshold) {
					throw new Error("Too many commands executed in this invocation");
				}

				const totalResult = [];
				let previousArguments = [];
				for (const [name, ...args] of input) {
					const result = await this.execute(name, ...args, ...previousArguments);
					totalResult.push(result);

					if (!result.success) {
						return totalResult;
					}

					previousArguments = (typeof result.reply === "string")
						? result.reply.split(/\s+/).filter(Boolean)
						: [];
				}

				return totalResult;
			},
			execute: async (command, ...args) => {
				if (typeof command !== "string") {
					throw new Error("Provided command name must be a string");
				}
				else if (args.some(i => typeof i !== "string")) {
					throw new Error("Provided command arguments must all be strings");
				}
				else if (commandExecutionCounter > commandExecutionCountThreshold) {
					throw new Error("Too many commands executed in this invocation");
				}
				else if (commandExecutionPending) {
					throw new Error("A command execution is already pending in this invocation");
				}

				const commandData = sb.Command.get(command);
				if (!commandData) {
					throw new Error("Command not found - separate command name from parameters");
				}
				else if (RESTRICTED_COMMAND_NAMES.has(commandData.Name)) {
					throw new Error("Provided command is not usable in the $js execution");
				}
				else if (!commandData.Flags.includes("pipe")) {
					throw new Error("This command cannot be used directly within this sandbox");
				}

				commandExecutionPending = true;
				commandExecutionCounter++;

				const execution = await sb.Command.checkAndExecute({
					command,
					args,
					user: context.user,
					channel: context.channel,
					platform: context.platform,
					platformSpecificData: context.platformSpecificData,
					options: {
						...context.append,
						partialExecute: true,
						pipe: true,
						skipPending: true,
						skipMention: true,
						skipBanphrases: true,
						tee: context.tee
					}
				});

				commandExecutionPending = false;

				const returnValue = {
					success: execution.success ?? true,
					reason: execution.reason ?? null,
					reply: execution.reply
				};

				if (execution.data && typeof execution.data === "object") {
					returnValue.data = execution.data;
				}

				return returnValue;
			}
		}),
		get tee () { return Object.freeze([...context.tee]); },
		_teePush (value) {
			if (typeof value !== "string") {
				throw new Error("Only string values can be pushed to tee");
			}

			return context.tee.push(value);
		},
		channelCustomData: core.Utils.deepFreeze({
			getKeys: () => {
				if (!customChannelData) {
					throw new Error("There is no channel data available here");
				}

				return Object.keys(customChannelData);
			},
			set: (key, value) => {
				if (!customChannelData) {
					throw new Error("There is no channel data available here");
				}
				else if (typeof key !== "string") {
					throw new Error("Only strings are available as keys");
				}
				else if (customChannelData[key] && !Object.hasOwn(customChannelData, key)) {
					throw new Error("Cannot overwrite prototype properties");
				}
				else if (!isTypeSupported(value)) {
					throw new Error("Only primitives (except bigint) and basic objects (Object, Array, Map, Set) are accepted as data property values");
				}

				channelDataChanged = true;
				customChannelData[key] = value;
			},
			get: (key) => {
				if (!customChannelData) {
					throw new Error("There is no channel data available here");
				}

				return (Object.hasOwn(customChannelData, key))
					? customChannelData[key]
					: undefined;
			}
		}),
		customData: core.Utils.deepFreeze({
			getKeys: () => Object.keys(customUserData),
			set: (key, value) => {
				if (typeof key !== "string") {
					throw new Error("Only strings are available as keys");
				}
				else if (customUserData[key] && !Object.hasOwn(customUserData, key)) {
					throw new Error("Cannot overwrite prototype properties");
				}
				else if (!isTypeSupported(value)) {
					throw new Error("Only primitives (except bigint) and basic objects (Object, Array, Map, Set) are accepted as data property values");
				}

				userDataChanged = true;
				customUserData[key] = value;
			},
			get: (key) => (Object.hasOwn(customUserData, key))
				? customUserData[key]
				: undefined
		}),
		utils: {
			getEmote: async (array, fallback, inputOptions = {}) => {
				if (!Array.isArray(array) || array.some(i => typeof i !== "string")) {
					throw new Error("Emotes must be provided as a string Array");
				}

				const options = {};
				if (typeof inputOptions?.caseSensitivity === "boolean") {
					options.caseSensitivity = inputOptions.caseSensitivity;
				}

				return await context.getBestAvailableEmote(array, fallback, options);
			},
			fetchEmotes: async () => {
				let emotes;
				if (context.channel) {
					emotes = await context.channel.fetchEmotes();
				}
				else {
					emotes = await context.platform.fetchGlobalEmotes();
				}

				return emotes;
			},
			parseParameter: (value, type) => {
				if (!ALLOWED_PARAMETER_TYPES.has(type)) {
					throw new Error("Invalid value type provided");
				}

				return sb.Command.parseParameter(value, type, true);
			},
			parseParametersFromArguments: (definition, args) => {
				if (!Array.isArray(definition) || definition.some(i => typeof i.name !== "string" || typeof i.type !== "string")) {
					throw new Error("Definition must be provided as an Array of { name: string, type: string }");
				}

				else if (!Array.isArray(args) || args.some(i => typeof i !== "string")) {
					throw new Error("Arguments must be provided as a string Array");
				}

				return sb.Command.parseParametersFromArguments(definition, args);
			},
			trim: (...args) => core.Utils.tag.trim(...args),
			unping: (string) => {
				if (typeof string !== "string") {
					throw new Error("Passed value must be a string");
				}
				else if (string.length === 0) {
					throw new Error("Empty strings cannot be unpinged");
				}

				return `${string[0]}\u{E0000}${string.slice(1)}`;
			}
		}
	};

	for (const method of allowedUtilsMethods) {
		sandbox.utils[method] = (...args) => core.Utils[method](...args);
	}

	return {
		sandbox,
		handleUserDataChange: async (limit) => {
			if (!userDataChanged) {
				return {
					success: true
				};
			}

			let string;
			try {
				string = advancedStringify(customUserData);
			}
			catch {
				return {
					success: false,
					reply: `Cannot stringify your custom data object!`
				};
			}

			if (string.length >= limit) {
				return {
					success: false,
					reply: `Your custom data object is too long! Maximum: ${limit}`
				};
			}

			await context.user.setDataProperty("customDeveloperData", JSON.parse(string));
			return {
				success: true
			};
		},
		handleChannelDataChange: async (limit) => {
			if (!context.channel || !channelDataChanged) {
				return {
					success: true
				};
			}

			let string;
			try {
				string = advancedStringify(customChannelData);
			}
			catch {
				return {
					success: false,
					reply: `Cannot stringify the channel custom data object!`
				};
			}

			if (string.length >= limit) {
				return {
					success: false,
					reply: `Your channel custom data object is too long! Maximum: ${limit}`
				};
			}

			await context.channel.setDataProperty("sharedCustomData", JSON.parse(string));
			return {
				success: true
			};
		},
		determineCommandCooldown: () => {
			if (queryExecutions.size > 0) {
				return 5000;
			}
			else {
				return null;
			}
		}
	};
};
