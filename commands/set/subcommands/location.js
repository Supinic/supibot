const { fetchGeoLocationData } = require("../../../utils/command-utils.js");

export default {
	name: "location",
	aliases: [],
	parameter: "arguments",
	description: `Sets/unsets your IRL location. If you add the keyword "private", it's going to be hidden. This location is used in commands such as weather, time, and others.`,
	flags: {
		pipe: false
	},
	set: async (context, ...args) => {
		let hidden = false;
		let visibilityType = null;
		if (args[0] === "private" || args[0] === "hidden") {
			hidden = true;
			visibilityType = args.shift();
		}
		else if (args[0] === "public" || args[0] === "visible") {
			hidden = false;
			visibilityType = args.shift();
		}

		if (args.length === 0) {
			const location = await context.user.getDataProperty("location");
			if (location && visibilityType !== null) {
				if (location.hidden === hidden) {
					return {
						success: false,
						reply: `Your location is already ${visibilityType}!`
					};
				}
				else {
					location.hidden = hidden;
					await context.user.setDataProperty("location", location);
					return {
						reply: `Your location is now ${visibilityType}!`
					};
				}
			}
			else {
				return {
					success: false,
					reply: "No location provided!",
					cooldown: 2500
				};
			}
		}

		const query = args.join(" ");
		const {
			components,
			coordinates,
			formatted,
			location,
			placeID,
			success
		} = await fetchGeoLocationData(query);

		if (!success) {
			return {
				success: false,
				reply: "No location found for given query!"
			};
		}

		await context.user.setDataProperty("location", {
			formatted,
			placeID,
			components,
			hidden,
			coordinates: coordinates ?? location,
			original: query
		});

		return {
			reply: `Successfully set your ${hidden ? "private" : "public"} location!`
		};
	},
	unset: async (context) => {
		const location = await context.user.getDataProperty("location");
		if (!location) {
			return {
				success: false,
				reply: `You don't have a location set up, so there is nothing to unset!`
			};
		}

		await context.user.setDataProperty("location", null);
		return {
			reply: "Your location has been unset successfully!"
		};
	}
};
