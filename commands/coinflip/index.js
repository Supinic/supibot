module.exports = {
	Name: "coinflip",
	Aliases: ["cf"],
	Author: "supinic",
	Cooldown: 2500,
	Description: "Flips a coin.",
	Flags: ["mention","pipe","skip-banphrase","use-params"],
	Params: [
		{ name: "fail", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function coinflip () {
		// According to Murray & Teare (1993), the probability of an American silver nickel landing on its edge is around 1 in 6000 tosses	
		const number =  sb.Utils.random(1, 6000);
		const flipResult = (number === 3000) ? null : Boolean(number < 3000);
		const replyMap = { true: "Heads! (yes)", false: "Tails! (no)", null: "The coin landed on its edge!!" };

		// if fail:true, then fail the command with success: false on the "no" and "edge" results
		let success = true;
		if (context.params.fail === true) {
			success = Boolean(flipResult);
		}

		return {
			success,
			reply: replyMap[flipResult]
		};
	}),
	Dynamic_Description: null
};