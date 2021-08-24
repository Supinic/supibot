// noinspection JSUnusedGlobalSymbols
module.exports = {
	execute: async (req, res, url) => {
		const invocation = url.searchParams.get("invocation");
		if (!invocation) {
			return {
				statusCode: 400,
				error: { message: `Valid command invocation must be provided` }
			};
		}

		const rawArguments = url.searchParams.get("arguments");
		const args = (rawArguments ?? "").split(" ");

		const platform = url.searchParams.get("platform") ?? "twitch";
		const channel = url.searchParams.get("channel");
		const user = url.searchParams.get("user");

		const channelData = sb.Channel.get(channel, platform) ?? null;
		const userData = await sb.User.get(user, true) ?? null;
		if (!userData) {
			return {
				statusCode: 400,
				error: { message: `Valid user must be provided` }
			};
		}

		const result = await sb.Command.checkAndExecute(
			invocation,
			args,
			channelData,
			userData
		);

		return {
			statusCode: 200,
			data: {
				result
			}
		};
	}
};
