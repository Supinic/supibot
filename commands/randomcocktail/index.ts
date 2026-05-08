import * as z from "zod";
import { declare } from "../../classes/command.js";

// region -- Zod query schema --
const filterSchema = z.object({
	drinks: z.union([
		z.array(z.object({ idDrink: z.string() })),
		z.string() // "no data found"
	])
});

const ing = z.string().nullable();
const drinkShape = z.object({
	drinks: z.array(z.object({
		strDrink: z.string(),
		strDrinkThumb: z.string(),
		strInstructions: z.string(),
		// yes, this is real (again, see the `randommeal` command)
		/* eslint-disable object-property-newline */
		strIngredient1: ing, strIngredient2: ing, strIngredient3: ing,
		strIngredient4: ing, strIngredient5: ing, strIngredient6: ing,
		strIngredient7: ing, strIngredient8: ing, strIngredient9: ing,
		strIngredient10: ing, strIngredient11: ing, strIngredient12: ing,
		strIngredient13: ing, strIngredient14: ing, strIngredient15: ing
		/* eslint-enable object-property-newline */
	})).nullable()
}).transform(({ drinks }) => {
	const result = [];
	for (const drink of drinks ?? []) {
		const ingredients = [];
		for (const [key, value] of Object.entries(drink)) {
			if (!/ingredient\d+/i.test(key) || !value) {
				continue;
			}

			ingredients.push(value);
		}

		result.push({
			name: drink.strDrink,
			thumbnail: drink.strDrinkThumb,
			instructions: drink.strInstructions,
			ingredients
		});
	}

	return result;
});
// endregion

export default declare({
	Name: "randomcocktail",
	Aliases: ["cock", "drinks", "tail", "cocktail"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Searches for a cocktail recipe by its name, or fetches a random one, if no search query was provided.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: [
		{ name: "ingredient", type: "string" }
	],
	Whitelist_Response: null,
	Code: (async function randomCocktail (context, ...args) {
		let data: z.infer<typeof drinkShape>;
		if (context.params.ingredient) {
			const filterResponse = await core.Got.get("GenericAPI")({
				url: "https://www.thecocktaildb.com/api/json/v1/1/filter.php",
				searchParams: {
					i: context.params.ingredient
				}
			});

			const { drinks } = filterSchema.parse(filterResponse.body);
			if (typeof drinks === "string" || drinks.length === 0) {
				return {
					success: false,
					reply: "No drinks found for your selected ingredient!"
				};
			}

			const { idDrink } = core.Utils.randArray(drinks);
			const response = await core.Got.get("GenericAPI")({
				url: "https://www.thecocktaildb.com/api/json/v1/1/lookup.php",
				searchParams: { i: idDrink }
			});

			data = drinkShape.parse(response.body);
		}
		else if (args.length === 0) {
			const response = await core.Got.get("GenericAPI")({
				url: "https://www.thecocktaildb.com/api/json/v1/1/random.php",
				responseType: "json"
			});

			data = drinkShape.parse(response.body);
		}
		else {
			const response = await core.Got.get("GenericAPI")({
				url: "https://www.thecocktaildb.com/api/json/v1/1/search.php",
				searchParams: {
					s: args.join(" ")
				}
			});

			data = drinkShape.parse(response.body);
		}

		if (data.length === 0) {
			return {
				success: false,
				reply: "No cocktails found for that query!"
			};
		}

		const { name, ingredients, instructions } = core.Utils.randArray(data);
		return {
			reply: `${name} (${ingredients.join(", ")}): ${instructions}`
		};
	}),
	Dynamic_Description: () => ([
		"Searches for a cocktail recipe based on its name or a specific ingredient.",
		"",

		`<code>$randomcocktail (name)</code>`,
		"Searches based on your query.",
		"",

		`<code>$randomcocktail ingredient:(ingredient name)</code>`,
		"Searches based on your ingredient name.",
		"",

		`<code>$randomcocktail</code>`,
		"Posts a completely random cocktail recipe."
	])
});
