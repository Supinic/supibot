module.exports = {
	Name: "randomdoctordisrespect",
	Aliases: ["rdd"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts a Markov chain-generated tweet from Dr. Disrespect.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function randomDoctorDisrepsect () {
		return {
			reply: "This command is not currently available - underoging maintenance."
		};
	
	/*
		const model = await sb.MarkovChain.get("disrespect");
		return {
			reply: model.sentences(3)
		};
	*/
	}),
	Dynamic_Description: null
};