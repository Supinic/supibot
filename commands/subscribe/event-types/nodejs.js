module.exports = {
	name: "Node.js updates",
	aliases: ["node", "nodejs", "node.js"],
	notes: "Every hour, supibot checks for new versions of Node.js. If a change is detected, you will be notified in the channel you subscribed in.",
	channelSpecificMention: true,
	response: {
		added: "You will now be pinged whenever a new version of Node.js is detected.",
		removed: "You will no longer receive pings when Node.js is updated."
	}
};
