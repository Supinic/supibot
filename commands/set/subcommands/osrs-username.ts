import type User from "../../../classes/user.js";
import { OSRS_GAME_USERNAME_KEY, fetchUserData } from "../../osrs/subcommands/osrs-utils.js";

// @todo Import from Command when done in Typescript
type Context = {
	user: User;
};
// @todo Import from Command when available
type Failure = {
	success: false;
	reply: string;
};
type Success = {
	success: true;
	reply: string;
};

export default {
	name: "osrs-username",
	aliases: [],
	parameter: "arguments",
	description: "Lets you set a default user identifier for the purposes of the $osrs command.",
	flags: {
		pipe: false
	},
	set: async (context: Context, ...args: string[]): Promise<Failure | Success> => {
		const identifier = args.join(" ");
		if (!identifier) {
			return {
				success: false,
				reply: "No username provided!"
			};
		}

		const checkUser = await fetchUserData(identifier);
		if (!checkUser.success) {
			return {
				success: false,
				reply: "Provided username does not exist in game!"
			};
		}

		const previous = await context.user.getDataProperty(OSRS_GAME_USERNAME_KEY) as string | undefined;
		await context.user.setDataProperty(OSRS_GAME_USERNAME_KEY, identifier);

		const string = (previous)
			? `changed your default $osrs username from ${previous} to ${identifier}`
			: `set your default $osrs username to ${identifier}`;

		return {
			success: true,
			reply: `Successfully ${string}.`
		};
	},
	unset: async (context: Context): Promise<Failure | Success> => {
		const existing = await context.user.getDataProperty(OSRS_GAME_USERNAME_KEY) as string | undefined;
		if (!existing) {
			return {
				success: false,
				reply: `You don't have a default $osrs username set up, so there is nothing to unset!`
			};
		}

		await context.user.setDataProperty(OSRS_GAME_USERNAME_KEY, null);
		return {
			success: true,
			reply: `Successfully unset your default $osrs username.`
		};
	}
};
