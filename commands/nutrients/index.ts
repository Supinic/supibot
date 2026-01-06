import * as z from "zod";
import { declare } from "../../classes/command.js";
import { SupiError } from "supi-core";

const searchSchema = z.object({
	totalHits: z.int().positive(),
	currentPage: z.int().positive(),
	foods: z.array(z.object({
		fdcId: z.int(),
		description: z.string(),
		servingSize: z.number(),
		servingSizeUnit: z.string(),
		brandName: z.string(),
		foodNutrients: z.array(z.object({
			nutrientId: z.int(),
			nutrientName: z.string(),
			value: z.number(),
			unitName: z.string()
		}))
	}))
});

const relevantNutrientIds = {
	energy: 1008,
	protein: 1003,
	fat: 1004,
	carbohdyrate: 1005
} as const;

const getNutrient = (
	name: keyof typeof relevantNutrientIds,
	data: z.infer<typeof searchSchema>["foods"][number]["foodNutrients"]
): number => {
	const id = relevantNutrientIds[name];
	const nutrient = data.find(i => id === i.nutrientId);
	if (!nutrient) {
		throw new SupiError({
		    message: `Assert error: Missing nutrient ${name}`
		});
	}

	return nutrient.value;
};

export default declare({
	Name: "nutrients",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts basic nutrients for a specified food query",
	Flags: ["mention","non-nullable","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function nutrients (context, ...args) {
		if (!process.env.API_USDA_FDC_KEY) {
			throw new SupiError({
				message: "No USDA FDC key configured (API_USDA_FDC_KEY)"
			});
		}

		if (args.length === 0) {
			return {
				success: false,
				reply: "No food provided!"
			};
		}

		const query = args.join(" ");
		const response = await core.Got.get("GenericAPI")({
			method: "POST",
			url: "https://api.nal.usda.gov/fdc/v1/foods/search",
			searchParams: {
				api_key: process.env.API_USDA_FDC_KEY
			},
			json: {
				query,
				pageSize: 1
			}
		});

		const { totalHits, foods } = searchSchema.parse(response.body);
		if (totalHits === 0) {
			return {
			    success: false,
			    reply: "No foods found for your query!"
			};
		}

		const {
			foodNutrients: nutrients,
			servingSizeUnit: unit,
			servingSize,
			description
		} = foods[0];

		const energy = getNutrient("energy", nutrients);
		const fat = getNutrient("fat", nutrients);
		const carbohdyrates = getNutrient("carbohdyrate", nutrients);
		const protein = getNutrient("protein", nutrients);

		const text = core.Utils.tag.trim `
			${servingSize}${unit} of ${description.toLowerCase()}
			contains
			${energy} kcal,
			${fat}g of fat,
			${carbohdyrates}g of carbohydrates,
			${protein}g protein.
		`;

		return {
			reply: text
		};
	}),
	Dynamic_Description: (prefix) => [
		"Fetches the nutrients for a given foodstuff. Usually results in US products being queried",
		"",

		`<code>${prefix}nutrients (foodstuff)</code>`,
		`<code>${prefix}nutrients cheddar cheese</code>`,
		`<code>${prefix}nutrients chicken breasts</code>`,
		"Shows the macro-nutrients for a given input: energy (kcal), fat, carbohydrates, protein."
	]
});
