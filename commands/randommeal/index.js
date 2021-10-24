module.exports = {
	Name: "randommeal",
	Aliases: ["rmeal"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Searches for a meal recipe by its name, or fetches a random one, if no search query was provided.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function randomMeal (context, ...args) {
		let data;

		if (args.length === 0) {
			const response = await sb.Got("GenericAPI", {
				url: "https://www.themealdb.com/api/json/v1/1/random.php"
			});

			data = response.body;
		}
		else {
			const response = await sb.Got("GenericAPI", {
				url: "https://www.themealdb.com/api/json/v1/1/search.php",
				searchParams: {
					s: args.join(" ")
				}
			});

			data = response.body;

			if (!data?.meals) {
				return {
					success: false,
					reply: "No recipes found for that query!"
				};
			}
		}

		const meal = sb.Utils.randArray(data.meals);
		const ingredients = [];
		for (const [key, value] of Object.entries(meal)) {
			if (!/ingredient\d+/i.test(key) || !value) {
				continue;
			}

			ingredients.push(value);
		}

		return {
			reply: `${meal.strMeal} - Ingredients: ${ingredients.join(", ")} ${meal.strYoutube}`
		};
	}),
	Dynamic_Description: null
};
