module.exports = {
	Name: "randomcocktail",
	Aliases: ["cock","drinks","tail","cocktail"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Searches for a cocktail recipe by its name, or fetches a random one, if no search query was provided.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function randomCocktail (context, ...args) {
		let data;
		if (args.length === 0) {
			const response = await sb.Got("GenericAPI", {
				url: "https://www.thecocktaildb.com/api/json/v1/1/random.php",
				responseType: "json"
			});

			data = response.body;
		}
		else {
			const response = await sb.Got("GenericAPI", {
				url: "https://www.thecocktaildb.com/api/json/v1/1/search.php",
				searchParams: {
					s: args.join(" ")
				}
			});

			data = response.body;

			if (!data?.drinks) {
				return {
					success: false,
					reply: "No cocktails found for that query!"
				};
			}
		}

		const drink = sb.Utils.randArray(data.drinks);
		const ingredients = [];
		for (const [key, value] of Object.entries(drink)) {
			if (!/ingredient\d+/i.test(key) || !value) {
				continue;
			}

			ingredients.push(value);
		}

		return {
			reply: `${drink.strDrink} (${ingredients.join(", ")}): ${drink.strInstructions}`
		};
	}),
	Dynamic_Description: null
};
