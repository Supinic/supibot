import * as z from "zod";
import { declare } from "../../classes/command.js";

// region -- Zod query schema --
const ing = z.string().nullable();
const mealsShape = z.array(z.object({
	strMeal: z.string(),
	strYoutube: z.string(),
	// yes, this is real
	/* eslint-disable object-property-newline */
	strIngredient1: ing, strIngredient2: ing, strIngredient3: ing, strIngredient4: ing,
	strIngredient5: ing, strIngredient6: ing, strIngredient7: ing, strIngredient8: ing,
	strIngredient9: ing, strIngredient10: ing, strIngredient11: ing, strIngredient12: ing,
	strIngredient13: ing, strIngredient14: ing, strIngredient15: ing, strIngredient16: ing,
	strIngredient17: ing, strIngredient18: ing, strIngredient19: ing, strIngredient20: ing
	/* eslint-enable object-property-newline */
})).transform((arg) => {
	const meals = [];
	for (const meal of arg) {
		const ingredients = [];
		for (const [key, value] of Object.entries(meal)) {
			if (!/ingredient\d+/i.test(key) || !value) {
				continue;
			}

			ingredients.push(value);
		}

		meals.push({
			name: meal.strMeal,
			videoLink: meal.strYoutube,
			ingredients
		});
	}

	return meals;
});
// endregion

const randomSchema = z.object({ meals: mealsShape });
const searchSchema = z.object({ meals: mealsShape.nullable() });

export default declare({
	Name: "randommeal",
	Aliases: ["rmeal"],
	Cooldown: 10000,
	Description: "Searches for a meal recipe by its name, or fetches a random one, if no search query was provided.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function randomMeal (context, ...args) {
		let meals: z.infer<typeof mealsShape>;
		if (args.length === 0) {
			const response = await core.Got.get("GenericAPI")({
				url: "https://www.themealdb.com/api/json/v1/1/random.php"
			});

			meals = randomSchema.parse(response.body).meals;
		}
		else {
			const response = await core.Got.get("GenericAPI")({
				url: "https://www.themealdb.com/api/json/v1/1/search.php",
				searchParams: {
					s: args.join(" ")
				}
			});

			const data = searchSchema.parse(response.body);
			if (!data.meals || data.meals.length === 0) {
				return {
					success: false,
					reply: "No recipes found for that query!"
				};
			}

			meals = data.meals;
		}

		const meal = core.Utils.randArray(meals);
		return {
			success: true,
			reply: `${meal.name} - Ingredients: ${meal.ingredients.join(", ")} ${meal.videoLink}`
		};
	}),
	Dynamic_Description: null
});
