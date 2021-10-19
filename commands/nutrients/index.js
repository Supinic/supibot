module.exports = {
	Name: "nutrients",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Posts basic nutrients for a specified food query",
	Flags: ["mention","non-nullable","pipe","use-params"],
	Params: [
		{ name: "specific", type: "string" }
	],
	Whitelist_Response: null,
	Static_Data: (() => ({
		nutrients: [
			{
				code: "CA",
				name: "Calcium",
				unit: "mg",
				id: 301
			},
			{
				code: "CHOLE",
				name: "Cholesterol",
				unit: "mg",
				id: 601
			},
			{
				code: "ENERC_KCAL",
				name: "Energy",
				unit: "kcal",
				id: 208
			},
			{
				code: "FASAT",
				name: "Saturated fatty acids",
				unit: "g",
				id: 606
			},
			{
				code: "FAT",
				name: "Fat",
				unit: "g",
				id: 204
			},
			{
				code: "FATRN",
				name: "Fatty trans-acids",
				unit: "g",
				id: 605
			},
			{
				code: "FE",
				name: "Iron",
				unit: "mg",
				id: 303
			},
			{
				code: "FIBTG",
				name: "Dietary fiber",
				unit: "g",
				id: 291
			},
			{
				code: "K",
				name: "Potassium",
				unit: "mg",
				id: 306
			},
			{
				code: "NA",
				name: "Sodium",
				unit: "mg",
				id: 307
			},
			{
				code: "PROCNT",
				name: "Protein",
				unit: "g",
				id: 203
			},
			{
				code: "SUGAR",
				name: "Sugars",
				unit: "g",
				id: 269
			},
			{
				code: "SUGAR_ADD",
				name: "Added sugars",
				unit: "g",
				id: 539
			},
			{
				code: "ALA_G",
				name: "Alanine",
				unit: "g",
				id: 513
			},
			{
				code: "ALC",
				name: "Ethyl alcohol",
				unit: "g",
				id: 221
			},
			{
				code: "ARG_G",
				name: "Arginine",
				unit: "g",
				id: 511
			},
			{
				code: "ASH",
				name: "Ash",
				unit: "g",
				id: 207
			},
			{
				code: "ASP_G",
				name: "Aspartic acid",
				unit: "g",
				id: 514
			},
			{
				code: "BETN",
				name: "Betaine",
				unit: "mg",
				id: 454
			},
			{
				code: "CAFFN",
				name: "Caffeine",
				unit: "mg",
				id: 262
			},
			{
				code: "CAMD5",
				name: "Campesterol",
				unit: "mg",
				id: 639
			},
			{
				code: "CARTA",
				name: "Alpha-carotene",
				unit: "µg",
				id: 322
			},
			{
				code: "CARTB",
				name: "Beta-carotene",
				unit: "µg",
				id: 321
			},
			{
				code: "CHOCAL",
				name: "Vitamin D3",
				unit: "µg",
				id: 326
			},
			{
				code: "CHOLN",
				name: "Choline",
				unit: "mg",
				id: 421
			},
			{
				code: "CRYPX",
				name: "Cryptoxanthin",
				unit: "µg",
				id: 334
			},
			{
				code: "CU",
				name: "Copper",
				unit: "mg",
				id: 312
			},
			{
				code: "CYS_G",
				name: "Cystine",
				unit: "g",
				id: 507
			},
			{
				code: "ENERC_KJ",
				name: "Energy",
				unit: "kJ",
				id: 268
			},
			{
				code: "ERGCAL",
				name: "Vitamin D2",
				unit: "µg",
				id: 325
			},
			{
				code: "FAMS",
				name: "Monounsaturated fatty acids",
				unit: "g",
				id: 645
			},
			{
				code: "FAPU",
				name: "Polyunsaturated fatty acids",
				unit: "g",
				id: 646
			},
			{
				code: "FATRNM",
				name: "Trans-monoenoic fatty acids",
				unit: "g",
				id: 693
			},
			{
				code: "FATRNP",
				name: "Trans-polyenoic fatty acids",
				unit: "g",
				id: 695
			},
			{
				code: "FLD",
				name: "Fluoride",
				unit: "µg",
				id: 313
			},
			{
				code: "FOL",
				name: "Folate",
				unit: "µg",
				id: 417
			},
			{
				code: "FOLAC",
				name: "Folic acid",
				unit: "µg",
				id: 431
			},
			{
				code: "FOLDFE",
				name: "Dietary folate equivalent",
				unit: "µg",
				id: 435
			},
			{
				code: "FOLFD",
				name: "Food folate",
				unit: "µg",
				id: 432
			},
			{
				code: "FRUS",
				name: "Fructose",
				unit: "g",
				id: 212
			},
			{
				code: "GALS",
				name: "Galactose",
				unit: "g",
				id: 287
			},
			{
				code: "GLU_G",
				name: "Glutamic acid",
				unit: "g",
				id: 515
			},
			{
				code: "GLUS",
				name: "Glucose",
				unit: "g",
				id: 211
			},
			{
				code: "GLY_G",
				name: "Glycine",
				unit: "g",
				id: 516
			},
			{
				code: "HISTN_G",
				name: "Histidine",
				unit: "g",
				id: 512
			},
			{
				code: "HYP",
				name: "Hydroxyproline",
				unit: "g",
				id: 521
			},
			{
				code: "ILE_G",
				name: "Isoleucine",
				unit: "g",
				id: 503
			},
			{
				code: "LACS",
				name: "Lactose",
				unit: "g",
				id: 213
			},
			{
				code: "LEU_G",
				name: "Leucine",
				unit: "g",
				id: 504
			},
			{
				code: "LUT_ZEA",
				name: "Lutein + zeaxanthin",
				unit: "µg",
				id: 338
			},
			{
				code: "LYCPN",
				name: "Lycopene",
				unit: "µg",
				id: 337
			},
			{
				code: "LYS_G",
				name: "Lysine",
				unit: "g",
				id: 505
			},
			{
				code: "MALS",
				name: "Maltose",
				unit: "g",
				id: 214
			},
			{
				code: "MET_G",
				name: "Methionine",
				unit: "g",
				id: 506
			},
			{
				code: "MG",
				name: "Magnesium",
				unit: "mg",
				id: 304
			},
			{
				code: "MK4",
				name: "Menaquinone-4",
				unit: "µg",
				id: 428
			},
			{
				code: "MN",
				name: "Manganese",
				unit: "mg",
				id: 315
			},
			{
				code: "NIA",
				name: "Niacin",
				unit: "mg",
				id: 406
			},
			{
				code: "P",
				name: "Phosphorus",
				unit: "mg",
				id: 305
			},
			{
				code: "PANTAC",
				name: "Pantothenic acid",
				unit: "mg",
				id: 410
			},
			{
				code: "PHE_G",
				name: "Phenylalanine",
				unit: "g",
				id: 508
			},
			{
				code: "PHYSTR",
				name: "Phytosterols",
				unit: "mg",
				id: 636
			},
			{
				code: "PRO_G",
				name: "Proline",
				unit: "g",
				id: 517
			},
			{
				code: "RETOL",
				name: "Retinol",
				unit: "µg",
				id: 319
			},
			{
				code: "RIBF",
				name: "Riboflavin",
				unit: "mg",
				id: 405
			},
			{
				code: "SE",
				name: "Selenium",
				unit: "µg",
				id: 317
			},
			{
				code: "SER_G",
				name: "Serine",
				unit: "g",
				id: 518
			},
			{
				code: "SITSTR",
				name: "Beta-sitosterol",
				unit: "mg",
				id: 641
			},
			{
				code: "STARCH",
				name: "Starch",
				unit: "g",
				id: 209
			},
			{
				code: "STID7",
				name: "Stigmasterol",
				unit: "mg",
				id: 638
			},
			{
				code: "SUCS",
				name: "Sucrose",
				unit: "g",
				id: 210
			},
			{
				code: "THEBRN",
				name: "Theobromine",
				unit: "mg",
				id: 263
			},
			{
				code: "THIA",
				name: "Thiamin",
				unit: "mg",
				id: 404
			},
			{
				code: "THR_G",
				name: "Threonine",
				unit: "g",
				id: 502
			},
			{
				code: "TOCPHA",
				name: "Vitamin E",
				unit: "mg",
				id: 323
			},
			{
				code: "TOCPHB",
				name: "Beta-tocopherol",
				unit: "mg",
				id: 341
			},
			{
				code: "TOCPHD",
				name: "Delta-tocopherol",
				unit: "mg",
				id: 343
			},
			{
				code: "TOCPHG",
				name: "Gamma-tocopherol",
				unit: "mg",
				id: 342
			},
			{
				code: "TRP_G",
				name: "Tryptophan",
				unit: "g",
				id: 501
			},
			{
				code: "TYR_G",
				name: "Tyrosine",
				unit: "g",
				id: 509
			},
			{
				code: "VAL_G",
				name: "Valine",
				unit: "g",
				id: 510
			},
			{
				code: "VITA_RAE",
				name: "Vitamin A (RAE)",
				unit: "µg",
				id: 320
			},
			{
				code: "VITB12",
				name: "Vitamin B-12",
				unit: "µg",
				id: 418
			},
			{
				code: "VITB6A",
				name: "Vitamin B-6",
				unit: "mg",
				id: 415
			},
			{
				code: "VITC",
				name: "Vitamin C",
				unit: "mg",
				id: 401
			},
			{
				code: "VITD",
				name: "Total vitamin D",
				unit: "µg",
				id: 324
			},
			{
				code: "VITK1",
				name: "Vitamin K",
				unit: "µg",
				id: 430
			},
			{
				code: "VITK1D",
				name: "Dihydrophylloquinone",
				unit: "µg",
				id: 429
			},
			{
				code: "WATER",
				name: "Water",
				unit: "g",
				id: 255
			},
			{
				code: "ZN",
				name: "Zinc",
				unit: "mg",
				id: 309
			},
			{
				code: "TOCTRA",
				name: "Alpha-tocotrienol",
				unit: "mg",
				id: 344
			},
			{
				code: "TOCTRB",
				name: "Beta-tocotrienol",
				unit: "mg",
				id: 345
			},
			{
				code: "TOCTRG",
				name: "Gamma-tocotrienol",
				unit: "mg",
				id: 346
			},
			{
				code: "TOCTRD",
				name: "Delta-tocotrienol",
				unit: "mg",
				id: 347
			}
		]
	})),
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

		const response = await sb.Got("GenericAPI", {
			method: "POST",
			url: "https://trackapi.nutritionix.com/v2/natural/nutrients",
			headers: {
				"x-app-id": sb.Config.get("API_NUTRITIONIX_APP_ID"),
				"x-app-key": sb.Config.get("API_NUTRITIONIX"),
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
			const definition = this.staticData.nutrients;
			const list = context.params.specific.split(/[,;/]/);
			const rawValid = list.map(item => (
				definition.find(i => i.code === item.toUpperCase() || i.name.toLowerCase() === item.toLowerCase())
			));

			customNutrients = new Set(rawValid.filter(Boolean));
			if (customNutrients.size === 0) {
				return {
					success: false,
					reply: `Could not pase any of your provided specific nutrients!`
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
					const data = food.full_nutrients.find(i => nutrient.attr_id === i.id);
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
	Dynamic_Description: null
};
