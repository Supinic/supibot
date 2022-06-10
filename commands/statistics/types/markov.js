module.exports = {
	name: "markov",
	aliases: [],
	description: "Returns quick stats about a markov module in a given channel.",
	execute: async (context, type, channelName) => {
		const module = sb.ChatModule.get("async-markov-experiment");
		if (!module) {
			return {
				success: false,
				reply: `No Markov module is currently available!`
			};
		}
		else if (!channelName) {
			return {
				success: false,
				reply: `No channel provided!`
			};
		}

		const channelData = sb.Channel.get(channelName ?? "forsen");
		if (!channelData) {
			return {
				success: false,
				reply: `Provided channel does not exist!`
			};
		}

		const markov = module.data.markovs.get(channelData.ID);
		if (!markov) {
			return {
				success: false,
				reply: "This channel does not have a markov-chain module configured!"
			};
		}

		return {
			reply: sb.Utils.tag.trim `
				Markov module for channel ${channelData.Name} currently has:
				${markov.size} unique words,
				and ${markov.edges ?? "(unknown)"} connections between words. 
			`
		};
	}
};
