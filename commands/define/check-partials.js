const FILTER_REASONS = new Set(["blacklist", "arguments", "opt-out"]);
const checkCommand = async (context, commandData, args) => await sb.Filter.execute({
	user: context.user,
	command: commandData,
	channel: context.channel,
	platform: context.platform,
	targetUser: args[0],
	args
});

export default async (context, commandArgs) => {
	const [dictFilter, urbanFilter, wikiFilter] = await Promise.all([
		checkCommand(context, sb.Command.get("dictionary"), commandArgs),
		checkCommand(context, sb.Command.get("urban"), commandArgs),
		checkCommand(context, sb.Command.get("wiki"), commandArgs)
	]);

	return {
		dictionary: !FILTER_REASONS.has(dictFilter.reason),
		urban: !FILTER_REASONS.has(urbanFilter.reason),
		wiki: !FILTER_REASONS.has(wikiFilter.reason)
	};
};
