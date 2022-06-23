module.exports = {
	Name: "time",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the current time and timezone for a given location, or a user, if they have set their location.",
	Flags: ["block","mention","non-nullable","opt-out","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		detectTimezone: async (...args) => {
			const place = args.join(" ");
			const timezone = await sb.Query.getRecordset(rs => rs
				.select("Abbreviation", "Offset", "Name")
				.from("data", "Timezone")
				.where("Abbreviation = %s", place)
				.limit(1)
				.single()
			);

			if (!timezone) {
				return null;
			}

			const extraOffset = (Math.trunc(timezone.Offset) - timezone.Offset) * 60;
			let offset = `${(`00${String(Math.trunc(timezone.Offset))}`).slice(-2)}:${(`00${extraOffset}`).slice(-2)}`;
			if (offset[0] !== "-") {
				offset = `+${offset}`;
			}

			const date = new sb.Date().setTimezoneOffset(timezone.Offset * 60).format("H:i (Y-m-d)");
			return {
				date,
				offset,
				abbr: timezone.Abbreviation,
				name: timezone.Name
			};
		},
		fetchTimeData: async (coordinates, timestamp = sb.Date.now()) => await sb.Got("Google", {
			url: "timezone/json",
			searchParams: {
				timestamp: Math.trunc(timestamp / 1000).toString(),
				location: `${coordinates.lat},${coordinates.lng}`,
				key: sb.Config.get("API_GOOGLE_TIMEZONE")
			}
		}).json()
	})),
	Code: (async function time (context, ...args) {
		const zone = await this.staticData.detectTimezone(...args);
		if (zone) {
			return {
				reply: `TIMEZONEDETECTED ${zone.abbr} is ${zone.name}, which is UTC${zone.offset} and it is ${zone.date} there right now.`
			};
		}

		let user = null;
		let skipLocation = false;
		let coordinates = null;
		let place = args.join(" ");

		if (args.length === 0) {
			const location = await context.user.getDataProperty("location");
			if (location) {
				user = context.user;
				coordinates = location.coordinates;
				skipLocation = location.hidden;
				place = location.formatted;
			}
			else {
				return {
					success: false,
					reply: "You must search for something first, or set your default location!",
					cooldown: 2500
				};
			}
		}
		else if (args[0].startsWith("@")) {
			const targetUser = await sb.User.get(args[0]);
			if (!targetUser) {
				return {
					success: false,
					reply: "That user does not exist!",
					cooldown: 2500
				};
			}
			else if (targetUser.Name === context.platform.Self_Name) {
				const robotEmote = await context.getBestAvailableEmote(["MrDestructoid"], "🤖");
				return {
					reply: `My current time is ${sb.Date.now()} ${robotEmote}`
				};
			}

			const targetUserLocation = await targetUser.getDataProperty("location");
			if (!targetUserLocation) {
				const message = (targetUser === context.user)
					? "You have not set up your location! You can use $set location (location) to set it, or add \"private\" to make it private 🙂"
					: "They have not set up their location!";

				return {
					success: false,
					reply: message,
					cooldown: 2500
				};
			}
			else {
				user = targetUser;
				coordinates = targetUserLocation.coordinates;
				skipLocation = targetUserLocation.hidden;
				place = targetUserLocation.formatted;
			}
		}

		if (coordinates === null) {
			const { results: [geoData] } = await sb.Got("Google", {
				url: "geocode/json",
				searchParams: {
					address: place,
					key: sb.Config.get("API_GOOGLE_GEOCODING")
				}
			}).json();

			if (!geoData) {
				const checkUserData = await sb.User.get(args[0]);
				const checkLocation = await checkUserData?.getDataProperty("location");

				if (checkUserData && !checkLocation) {
					return {
						success: false,
						reply: `That place was not found! However, you probably meant to check that user's location - make sure to add the @ symbol before their name.`,
						cooldown: 5000
					};
				}

				const sadEmote = await context.getBestAvailableEmote(["peepoSadDank", "FeelsBadMan"], "😟");
				return {
					success: false,
					reply: `That place was not found! ${sadEmote}`
				};
			}
			else {
				coordinates = geoData.geometry.location;
			}
		}

		const response = await sb.Utils.fetchTimeData({
			coordinates,
			key: sb.Config.get("API_GOOGLE_TIMEZONE")
		});

		const timeData = response.body;
		if (response.statusCode !== 200) {
			throw new sb.errors.GenericRequestError({
				statusCode: response.statusCode,
				hostname: "maps.googleapis.com",
				statusMessage: timeData.statusMessage ?? null,
				message: timeData.message ?? null,
				stack: null
			});
		}
		else if (timeData.status === "ZERO_RESULTS") {
			return {
				success: false,
				reply: "Target place is ambiguous - it contains more than one timezone!"
			};
		}

		const totalOffset = (timeData.rawOffset + timeData.dstOffset);
		const symbol = (totalOffset >= 0 ? "+" : "-");
		const hours = Math.trunc(Math.abs(totalOffset) / 3600);
		const minutes = sb.Utils.zf((Math.abs(totalOffset) % 3600) / 60, 2);

		const offset = `${symbol}${hours}:${minutes}`;
		const time = new sb.Date();
		time.setTimezoneOffset(totalOffset / 60);

		if (user) {
			const locationData = await user.getDataProperty("location");
			if (locationData && (!locationData.timezone || locationData.timezone?.dstOffset === 1111)) {
				locationData.timezone = {
					dstOffset: timeData.dstOffset,
					stringOffset: offset,
					offset: totalOffset,
					name: timeData.timeZoneName
				};

				await user.setDataProperty("location", locationData);
			}
		}

		const locationDateTime = time.format("H:i (Y-m-d)");
		if (skipLocation) {
			return {
				reply: sb.Utils.tag.trim `
					(location hidden) is using UTC${offset},
					and it's ${locationDateTime} there right now.
				 `
			};
		}
		else {
			return {
				reply: sb.Utils.tag.trim `
					${place} is currently observing ${timeData.timeZoneName}, 
					which is UTC${offset},
					and it's ${locationDateTime} there right now.
				 `
			};
		}
	}),
	Dynamic_Description: (async (prefix) => [
		"For a provided location, returns the current time, timezone and date it is observing.",
		`Supports custom locations of users - this can be set with the <a href="/bot/command/detail/set"><code>${prefix}set location</code></a> command.`,
		"",

		`<code>${prefix}time (location)</code>`,
		"Shows the location's time data.",
		"",

		`<code>${prefix}time</code>`,
		`If you have set your custom location with the <code>${prefix}set</code> command (see above), this command will return your location's time data.`,
		"",

		`<code>${prefix}time @(user)</code>`,
		`Similar to your own custom location, but for a different user. Make sure to include the <code>@</code> symbol!`,
		""
	])
};
