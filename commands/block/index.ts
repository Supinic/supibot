import { handleGenericFilter, parseGenericFilterOptions } from "../../utils/command-utils.js";
import { Filter } from "../../classes/filter.js";
import { type User } from "../../classes/user.js";
import type { Command, Context } from "../../classes/command.js";
import { SupiError } from "supi-core";

const params = [
	{ name: "channel", type: "string" },
	{ name: "command", type: "string" },
	{ name: "id", type: "number" },
	{ name: "platform", type: "string" },
	{ name: "user", type: "string" }
] as const;

type HasVerbOptions = { enableVerb: string; disableVerb: string; };
const fillUsernameProperties = async <T extends HasVerbOptions> (options: T, blockedUserId: User["ID"] | null): Promise<T> => {
	if (!blockedUserId) {
		throw new SupiError({
			message: "Assert error: Block-Filter User ID is null",
			args: { blockedUserId }
		});
	}

	const blockedUserData = await sb.User.get(blockedUserId);
	if (!blockedUserData) {
		throw new SupiError({
			message: "Assert error: Block-Filter User does not exist",
			args: { blockedUserId }
		});
	}

	options.enableVerb = `blocked ${blockedUserData.Name} from`;
	options.disableVerb = `unblocked ${blockedUserData.Name} from`;

	return options;
};

export default {
	Name: "block",
	Aliases: ["unblock"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Blocks, or unblocks a specified user from using a specified command with you as the target. You can also set a channel, or platform for the block to be active on.",
	Flags: ["mention"],
	Params: params,
	Whitelist_Response: null,
	Code: (async function block (this: Command, context: Context<typeof params>, ...args: string[]) {
		const parse = await parseGenericFilterOptions("Block", context.params, args, {
			argsOrder: ["user", "command"],
			requiredCommandFlag: "block",
			requiredCommandFlagResponse: "You cannot block people from this command!",
			includeUser: true
		});

		if (!parse.success) {
			return parse;
		}

		const baseOptions = {
			context,
			filter: null,
			filterData: null,
			enableInvocation: this.Name,
			disableInvocation: this.Aliases[0],
			enableVerb: "", // will be filled later on within `fillUsernameProperties`
			disableVerb: "" // same as above
		};

		if (parse.filter instanceof Filter) {
			const options = await fillUsernameProperties(baseOptions, parse.filter.Blocked_User);
			return await handleGenericFilter("Block", {
				...options,
				filter: parse.filter
			});
		}

		const parseFilterData = parse.filter;
		if (!parseFilterData.user) {
			return {
				success: false,
				reply: `You must provide someone to block!`
			};
		}

		const targetUser = await sb.User.get(parseFilterData.user);
		if (targetUser && targetUser.Name === context.platform.selfName) {
			const emote = await context.randomEmote("monkaStare", "supiniStare", "😬🫵");
			return {
				success: false,
				reply: `I wouldn't try that! ${emote}`
			};
		}

		const blockFilters = sb.Filter.getLocals("Block", {
			user: context.user,
			command: parseFilterData.command,
			includeInactive: true
		});

		const blockFilter = blockFilters.find(i => (
			i.Channel === parseFilterData.channel
			&& i.Platform === parseFilterData.platform
			&& i.Blocked_User === parseFilterData.user
			&& i.Command === parseFilterData.command
		));

		if (blockFilter) {
			const options = await fillUsernameProperties(baseOptions, blockFilter.Blocked_User);
			return await handleGenericFilter("Block", {
				...options,
				filter: blockFilter
			});
		}
		else {
			const options = await fillUsernameProperties(baseOptions, parseFilterData.user);
			return await handleGenericFilter("Block", {
				...options,
				filterData: parseFilterData
			});
		}
	}),
	Dynamic_Description: () => ([
		"Blocks a specified user from using the specified command with you as the parameter",
		"",

		`<code>$block (user) (command)</code>`,
		`<code>$block user:(user) command:(command)</code>`,
		`<code>$block Kappa rl</code>`,
		`<code>$block user:Kappa command:rl</code>`,
		`Blocks the user Kappa from using the command rl on you. Then, they can't do <code>$rl (your name)</code>`,
		"",

		`<code>$unblock (user) (command)</code>`,
		`Unblocks the user from a given command.`,
		"",

		`<code>$block (user) all</code>`,
		`<code>$block user:(user) command:all</code>`,
		`Blocks provided user from all current and future commands that support blocking people.`,
		"NOTE: <u>This command will not block the user from each command separately!</u> It simply applies a single setting that blocks them from all blockable commands, present and future.",
		"This means you can't <u>$block (user) all</u> and then separately <u>$unblock (user)</u> from other commands in particular.",
		"",

		`<code>$block id:(ID)</code>`,
		`<code>$unblock id:(ID)</code>`,
		`You can also target your filter specifically by its ID that the bot tells you when you created it.`,
		`Furthermore, you can list your active filters in your <a href="/user/data/list">user data list</a> as <u>activeFilters</u>.`,
		"",

		`<code>$block user:(usr) channel:(chn) command:(cmd) platform:(p)</code>`,
		`Will block given user from a specified combination of channel/command/platform.`,
		"E.g.:",
		`<ul>
				<li> 
					<code>$block command:rl user:Kappa channel:supibot</code>
					<br>
					Blocks user Kappa from command rl only in channel "supibot".
				</li>
				<li> 
					<code>$block command:rl user:Kappa platform:twitch</code>
					<br>
					Blocks user Kappa from command rl, but only on Twitch.
				</li>
				<li> 
					<code>$block user:Kappa channel:supibot</code>
					<br>
					Blocks Kappa from all blockable commands, but only in channel "supibot".
				</li>
			</ul>`
	])
};
