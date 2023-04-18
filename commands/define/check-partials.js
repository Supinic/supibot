const filterReasons = ["blacklist", "arguments", "opt-out"];
const checkCommand = async (context, commandData, args) => await sb.Filter.execute({
	user: context.user,
	command: commandData,
	channel: context.channel,
	platform: context.platform,
	targetUser: args[0],
	args
});

module.exports = {
	checkPartialCommandFilters: async (context, commandArgs) => {
		const [dictFilter, urbanFilter, wikiFilter] = await Promise.all([
			checkCommand(context, sb.Command.get("dictionary"), commandArgs),
			checkCommand(context, sb.Command.get("urban"), commandArgs),
			checkCommand(context, sb.Command.get("wiki"), commandArgs)
		]);

		return {
			dictionary: !filterReasons.includes(dictFilter.reason),
			urban: !filterReasons.includes(urbanFilter.reason),
			wiki: !filterReasons.includes(wikiFilter.reason)
		};
	}
};
