import { declare } from "../../classes/command.js";

const EIGHT_BALL_RESPONSES = [
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
];

export default declare({
	Name: "8ball",
	Aliases: null,
	Cooldown: 10000,
	Description: "Checks your question against the fortune-telling 8-ball.",
	Flags: ["mention", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (function _8ball () {
		return {
			reply: core.Utils.randArray(EIGHT_BALL_RESPONSES)
		};
	}),
	Dynamic_Description: (function (prefix) {
		const list = EIGHT_BALL_RESPONSES.map(i => `<li>${i}</li>`).join("");

		return [
			"Consult the 8-ball for your inquiry!",
			"",

			`<code>${prefix}8ball Is this command cool?</code>`,
			"(random 8-ball response)",
			"",

			"List of responses:",
			`<ul>${list}</ul>`
		];
	})
});
