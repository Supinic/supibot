import * as z from "zod";
import { declare } from "../../classes/command.js";

// region Zod query schema
const mealsShape = z.array(z.object({
	strMeal: z.string(),
	strYoutube: z.string(),
	/* eslint-disable object-property-newline */
	strIngredient1: z.string(), strIngredient2: z.string(), strIngredient3: z.string(), strIngredient4: z.string(),
	strIngredient5: z.string(), strIngredient6: z.string(), strIngredient7: z.string(), strIngredient8: z.string(),
	strIngredient9: z.string(), strIngredient10: z.string(), strIngredient11: z.string(), strIngredient12: z.string(),
	strIngredient13: z.string(), strIngredient14: z.string(), strIngredient15: z.string(), strIngredient16: z.string(),
	strIngredient17: z.string(), strIngredient18: z.string(), strIngredient19: z.string(), strIngredient20: z.string()
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
