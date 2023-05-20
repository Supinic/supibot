module.exports = {
	name: "buy",
	aliases: [],
	description: [
		"Buy goodies at the fishing gear store.",
		"",

		`<code>$fish buy</code>`,
		"Does nothing at the moment"
	],
	execute: async () => ({
		reply: "There isn't anything you can buy at the fishing gear shop... yet."
	})
};
