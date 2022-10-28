module.exports = {
	name: "Rust",
	aliases: ["rust"],
	notes: "Every hour, Supibot checks for news on the Rust language RSS. If a new article is detected, you will be notified in the channel you subscribed in.",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new Rust article is published.",
		removed: "You will no longer receive pings when a new Rust article is published."
	}
};
