module.exports = {
	Name: "8ball",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Checks your question against the fortune-telling 8-ball.",
	Flags: ["mention","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		responses: [
			"😃 It is certain.",
			"😃 It is decidedly so.",
			"😃 Without a doubt.",
			"😃 Yes - definitely.",
			"😃 You may rely on it.",
			"😃 As I see it, yes.",
			"😃 Most likely.",
			"😃 Outlook good.",
			"😃 Yes.",
			"😃 Signs point to yes.",
			"😐 Reply hazy, try again.",
			"😐 Ask again later.",
			"😐 Better not tell you now.",
			"😐 Cannot predict now.",
			"😐 Concentrate and ask again.",
			"😦 Don't count on it.",
			"😦 My reply is no.",
			"😦 My sources say no.",
			"😦 Outlook not so good.",
			"😦 Very doubtful."
		]
	})),
	Code: (async function _8ball () {
		return {
			reply: sb.Utils.randArray(this.staticData.responses)
		};
	}),
	Dynamic_Description: (async function (prefix) {
		const { responses } = this.staticData;
		const list = responses.map(i => `<li>${i}</li>`).join("");

		return [
			"Consult the 8-ball for your inquiry!",
			"",

			`<code>${prefix}8ball Is this command cool?</code>`,
			sb.Utils.randArray(responses),
			"",

			"List of responses:",
			`<ul>${list}</ul>`
		];
	})
};
