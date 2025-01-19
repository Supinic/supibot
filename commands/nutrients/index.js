import NUTRIENTS_DATA from "./nutrients.json";

export default {
	Name: "nutrients",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts basic nutrients for a specified food query",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "specific", type: "string" }
	],
	Whitelist_Response: null,
	Code: (async function nutrients (context, ...args) {
		if (!process.env.API_NUTRITIONIX || !process.env.API_NUTRITIONIX_APP_ID) {
			throw new sb.Error({
				message: "No Nutritionix key/AppID configured (API_NUTRITIONIX, API_NUTRITIONIX_APP_ID)"
			});
		}

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

		const response = await sb.Got.get("GenericAPI")({
			method: "POST",
			url: "https://trackapi.nutritionix.com/v2/natural/nutrients",
			headers: {
				"x-app-key": process.env.API_NUTRITIONIX,
				"x-app-id": process.env.API_NUTRITIONIX_APP_ID,
				"x-remote-user-id": 0
			},
			json: { query },
			throwHttpErrors: false
		});

		if (response.body.message) {
			return {
				success: false,
				reply: response.body.message
			};
		}

		let customNutrients;
		if (context.params.specific) {
			const list = context.params.specific.split(/[,;/]/);
			const rawValid = list.map(item => (
				NUTRIENTS_DATA.find(i => i.code === item.toUpperCase() || i.name.toLowerCase() === item.toLowerCase())
			));

			customNutrients = new Set(rawValid.filter(Boolean));

			if (customNutrients.size === 0) {
				return {
					success: false,
					reply: `Could not parse any of your provided specific nutrients!`
				};
			}
		}

		const foodstuffs = [];
		for (const food of response.body.foods) {
			const specificWeight = (food.serving_qty === 100 && food.serving_unit === "g")
				? ""
				: `(${food.serving_weight_grams}g)`;

			const start = sb.Utils.tag.trim `
				${food.serving_qty}${food.serving_unit} of ${food.food_name}
				${specificWeight}
				contains
			`;

			if (customNutrients) {
				const nutrientList = [...customNutrients].map(nutrient => {
					const data = food.full_nutrients.find(i => nutrient.id === i.attr_id);
					if (!data) {
						return;
					}

					return `${data.value}${nutrient.unit} of ${nutrient.name}`;
				});

				foodstuffs.push(sb.Utils.tag.trim `
					${start}
					${nutrientList.filter(Boolean).join(", ")}.					
				`);
			}
			else {
				foodstuffs.push(sb.Utils.tag.trim `
					${start}
					${food.nf_calories} kcal,
					${food.nf_total_fat}g of fat (${food.nf_saturated_fat ?? 0}g saturated),
					${food.nf_total_carbohydrate}g of carbohydrates (${food.nf_sugars ?? 0}g sugar),
					${food.nf_protein}g protein.
				`);
			}
		}

		return {
			reply: foodstuffs.join("; ")
		};
	}),
	Dynamic_Description: (async function (prefix) {
		const tableBody = [...NUTRIENTS_DATA]
			.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
			.map(i => `<tr><td>${i.name}</td><td>${i.code}</td></tr>`).join("");

		return [
			"Fetches the nutrients for a given foodstuff (or multiple, if provided).",
			"",

			`<code>${prefix}nutrients (foodstuff)</code>`,
			"Shows the macro-nutrients for a given input: energy (kcal), fat (saturated), carbohydrates (sugar), protein.",
			"",

			`<code>${prefix}nutrients (foodstuff) specific:(comma-separated list of specific nutrients)</code>`,
			`<code>${prefix}nutrients coffee specific:caffeine,copper,FE</code>`,
			"Shows a list of specific nutrients' values for your input. For available specific nutrients, check the table below.",
			"Either the name or the code of a specific nutrient works.",
			"",

			`<table>
				<tr>
					<th>Name</th>
					<th>Code</th>
				</tr>
				${tableBody}	
			</table>
			`
		];
	})
};
