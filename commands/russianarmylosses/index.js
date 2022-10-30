module.exports = {
	Name: "russianarmylosses",
	Aliases: ["ral"],
	Author: "boring_nick",
	Cooldown: 15000,
	Description: "Fetches the latest losses of the Russian Army in Ukraine, as provided by the General Staff of Ukraine.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		// While this data is provided by the API, some names are too long for chat and have been shortened.
		// https://russianwarship.rip/api-documentation/v1#/Terms/getAllStatisticalTerms
		terms: {
			personnel_units: "Personnel",
			tanks: "Tanks",
			armoured_fighting_vehicles: "Combat vehicles",
			artillery_systems: "Artillery",
			mlrs: "MLRS",
			aa_warfare_systems: "AA",
			planes: "Planes",
			helicopters: "Helicopters",
			vehicles_fuel_tanks: "Vehicles/Fuel tanks",
			warships_cutters: "Ships",
			cruise_missiles: "Missiles",
			uav_systems: "UAV",
			special_military_equip: "Special equipment",
			atgm_srbm_systems: "ATGM/SRBM"
		}
	})),
	Code: (async function russianArmyLosses (context, term) {
		const terms = this.staticData.terms;
		const response = await sb.Got("GenericAPI", {
			url: "https://russianwarship.rip/api/v1/statistics/latest"
		});

		let reply;
		const { increase, stats } = response.body.data;
		if (term) {
			let key;
			for (const termKey in terms) {
				if (terms[termKey].toLowerCase() === term.toLowerCase()) {
					key = termKey;
					term = terms[termKey];
					break;
				}
			}

			if (!key) {
				return {
					success: false,
					reply: "An invalid term has been provided!"
				};
			}

			reply = `Latest Russian Army losses for ${term}: ${stats[key]}`;
			const statsIncrease = increase[key];
			if (statsIncrease !== 0) {
				reply += ` (+${statsIncrease})`;
			}
		}
		else {
			const replyParts = Object.keys(stats).map(key => {
				// In case there is a new term, use the key as a fallback
				const term = terms[key] ?? key;
				let msg = `${term}: ${stats[key]}`;

				if (increase[key] !== 0) {
					msg += ` (+${increase[key]})`;
				}

				return msg;
			});

			reply = `Latest Russian Army losses: ${replyParts.join(", ")}`;
		}

		return {
			reply
		};
	}),
	Dynamic_Description: null
};
