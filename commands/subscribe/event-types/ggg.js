module.exports = {
	name: "GGG tracker",
	aliases: ["ggg", "poe"],
	notes: "Every minute, Supibot checks for new posts by GGG staff on their forums and Reddit. If you are subscribed, a new post like this will ping you in the channel you subscribed in.",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever GGG staff posts.",
		removed: "You will no longer be pinged when GGG staff posts."
	}
};
