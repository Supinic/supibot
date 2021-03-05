module.exports = {
	Name: "nutrients",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts basic nutrients for a specified food query",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function nutrients (context, ...args) {
		if (args.length === 0) {
			return {
				success: false,
				reply: "No food provided!"
			};
		}

		let query = args.join(" ");
		if (!/\d/.test(query)) {
			query = `100g of ${query}`;
		}

		const data = await sb.Got({
			method: "POST",
			url: "https://trackapi.nutritionix.com/v2/natural/nutrients",
			headers: {
				"x-app-id": sb.Config.get("API_NUTRITIONIX_APP_ID"),
				"x-app-key": sb.Config.get("API_NUTRITIONIX"),
				"x-remote-user-id": 0
			},
			json: { query },
			throwHttpErrors: false
		}).json();
	
		if (data.message) {
			return {
				success: false,
				reply: data.message
			};
		}
		else if (data.foods.length > 1) {
			return {
				success: false,
				reply: "Only one food is supported at a time (for now)"
			};
		}

		const food = data.foods[0];
		return {
			reply: sb.Utils.tag.trim `
				${food.serving_qty} ${food.serving_unit} ${food.food_name}
				(${food.serving_weight_grams}g)
				contains
				${food.nf_calories} kcal,
				${food.nf_total_fat}g of fat (${food.nf_saturated_fat ?? 0}g saturated),
				${food.nf_total_carbohydrate}g of carbohydrates (${food.nf_sugars ?? 0}g sugar),
				${food.nf_protein}g protein
			`
		};
	}),
	Dynamic_Description: null
};