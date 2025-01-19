import { subcommands } from "./subcommands/index.js";

export default {
	Name: "set",
	Aliases: ["unset"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Sets/unsets certain variables within Supibot. Check the extended help for full info.",
	Flags: ["mention","pipe"],
	Params: [
		{ name: "from", type: "string" }
	],
	Whitelist_Response: null,
	Code: (async function set (context, type, ...args) {
		if (!type) {
			return {
				success: false,
				reply: "No type provided!"
			};
		}

		const { invocation } = context;
		type = type.toLowerCase();

		const target = subcommands.find(i => type === i.name || i.aliases?.includes(type));
		if (!target) {
			return {
				success: false,
				reply: "Invalid type provided!"
			};
		}
		else if (typeof target[invocation] !== "function") {
			return {
				success: false,
				reply: `You cannot ${invocation} the type ${type}!`
			};
		}
		else if (!target.flags.pipe && context.append.pipe) {
			return {
				success: false,
				reply: `You cannot use the type ${type} in a pipe`
			};
		}

		const permissions = await context.getUserPermissions();
		if (target.flags.ownerOnly && permissions.flag < sb.User.permissions.channelOwner) {
			return {
				success: false,
				reply: `Only channel owners and administrators can work with the type "${type}"!`
			};
		}
		else if (target.flags.elevatedChannelAccess && permissions.flag === sb.User.permissions.regular) {
			return {
				success: false,
				reply: `Only channel owners and ambassadors can work with the type "${type}"!`
			};
		}

		if (target.parameter === "arguments") {
			return await target[invocation](context, ...args);
		}
		else if (target.parameter === "ID") {
			if (invocation === "unset" && context.params.from && typeof target.userSpecificUnset === "function") {
				return await target.userSpecificUnset(context);
			}
			else if (args.length === 0) {
				return {
					success: false,
					reply: "At least one item must be provided!"
				};
			}

			let IDs = args.map(Number).filter(Boolean);
			if (args[0] === "last") {
				if (typeof target.getLastID !== "function") {
					return {
						success: false,
						reply: `You cannot use the keyword "last" while ${invocation}ting a ${type}!`
					};
				}

				const lastID = await target.getLastID(context);
				if (typeof lastID !== "number") {
					return {
						success: false,
						reply: `You don't have any active ${type}s to be ${invocation}!`
					};
				}

				IDs = [lastID];
			}

			if (IDs.length === 0 && args.length !== 0) {
				return {
					success: false,
					reply: "No valid numeric IDs provided!"
				};
			}

			if (IDs.length > 1 && invocation === "set") {
				return {
					success: false,
					reply: "Cannot set more than one item at a time!"
				};
			}

			const results = [];
			for (const ID of IDs) {
				if (!sb.Utils.isValidInteger(ID)) {
					results.push({
						ID,
						success: false,
						reply: `Provided ID is not a valid number!`
					});

					continue;
				}

				const subResult = await target[invocation](context, ID);
				results.push({ ID, ...subResult });
			}

			if (results.length === 0) {
				return await target[invocation](context);
			}
			else if (results.length === 1) {
				return {
					success: results[0].success,
					reply: results[0].reply
				};
			}
			else {
				const [success, fail] = sb.Utils.splitByCondition(results, i => (i.success !== false));
				const successString = (success.length > 0)
					? `Success: ${invocation}ting IDs ${success.map(i => i.ID).join(", ")}.`
					: "";
				const failString = (fail.length > 0)
					? `Fail: ${invocation}ting IDs ${fail.map(i => i.ID).join(", ")}.`
					: "";

				return {
					reply: [successString, failString].filter(Boolean).join(" ")
				};
			}
		}
	}),
	Dynamic_Description: (async function (prefix) {
		const list = variables.map(i => {
			let names = i.name;
			if (i.aliases.length > 0) {
				names += `(${i.aliases.join(", ")})`;
			}

			const types = [
				(i.set) ? "set" : "",
				(i.unset) ? "unset" : ""
			].filter(Boolean).join("/");

			const noPipeInfo = (i.pipe) ? "" : ", cannot be piped";

			return `<li><code>${names}</code> (${types}${noPipeInfo}) ${i.description}</li>`;
		}).join("");

		return [
			"Sets a variable that you can then use in Supibot's commands.",
			"",

			`<code>${prefix}set (variable) (data)</code>`,
			`Sets the variable of the given type with given data.`,
			"",

			"List of variables:",
			`<ul>${list}</ul>`
		];
	})
};
