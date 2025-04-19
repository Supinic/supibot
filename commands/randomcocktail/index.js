export default {
	Name: "randomcocktail",
	Aliases: ["cock","drinks","tail","cocktail"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Searches for a cocktail recipe by its name, or fetches a random one, if no search query was provided.",
	Flags: ["mention","non-nullable","pipe"],
	Params: [
		{ name: "ingredient", type: "string" }
	],
	Whitelist_Response: null,
	Code: (async function randomCocktail (context, ...args) {
		let response;
		if (context.params.ingredient) {
			const drinkResponse = await core.Got.get("GenericAPI")({
				url: "https://www.thecocktaildb.com/api/json/v1/1/filter.php",
				searchParams: {
					i: context.params.ingredient
				}
			});

			const ingredientDrinks = drinkResponse.body.drinks;
			if (!ingredientDrinks || ingredientDrinks.length === 0) {
				return {
					success: false,
					reply: "No drinks found for your selected ingredient!"
				};
			}

			const randomDrink = core.Utils.randArray(ingredientDrinks);
			response = await core.Got.get("GenericAPI")({
				url: "https://www.thecocktaildb.com/api/json/v1/1/lookup.php",
				searchParams: {
					i: randomDrink.idDrink
				}
			});
		}
		else if (args.length === 0) {
			response = await core.Got.get("GenericAPI")({
				url: "https://www.thecocktaildb.com/api/json/v1/1/random.php",
				responseType: "json"
			});
		}
		else {
			response = await core.Got.get("GenericAPI")({
				url: "https://www.thecocktaildb.com/api/json/v1/1/search.php",
				searchParams: {
					s: args.join(" ")
				}
			});
		}

		const data = response.body;
		if (!data?.drinks) {
			return {
				success: false,
				reply: "No cocktails found for that query!"
			};
		}

		const drink = core.Utils.randArray(data.drinks);
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
	Dynamic_Description: async () => ([
		"Searches for a cocktail recipe based on its name or ingredient(s).",
		"",

		`<code>$randomcocktail (name)</code>`,
		"Searches based on your query",
		"",

		`<code>$randomcocktail ingredient:(ingredient name)</code>`,
		"Searches based on your ingredient name",
		"",

		`<code>$randomcocktail</code>`,
		"Posts a completely random cocktail recipe"
	])
};
