module.exports = {
	Name: "randomcocktail",
	Aliases: ["cock", "drinks", "tail"],
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 10000,
	Description: "Searches for a cocktail recipe by its name, or fetches a random one, if no search query was provided.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function randomCocktail (context, ...args) {
		let data = null;
		if (args.length === 0) {
			data = await sb.Got("https://www.thecocktaildb.com/api/json/v1/1/random.php").json();
		}
		else {
			data = await sb.Got({
				url: "https://www.thecocktaildb.com/api/json/v1/1/search.php",
				searchParams: new sb.URLParams()
					.set("s", args.join(" "))
					.toString()
			}).json();
	
			if (!data?.drinks) {
				return {
					success: false,
					reply: "No cocktails found for that query!"
				};
			}
		}
		
		const drink = sb.Utils.randArray(data.drinks);
		const ingredients = Object.entries(drink).filter(([key, value]) => /ingredient\d+/i.test(key)).map(([key, value]) => value).filter(Boolean);
	
		return {
			reply: `${drink.strDrink} (${ingredients.join(", ")}): ${drink.strInstructions}`
		};
	}),
	Dynamic_Description: null
};