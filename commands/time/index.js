module.exports = {
	Name: "time",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches the current time and timezone for a given location",
	Flags: ["mention","pipe"],
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
			let offset = ("00" + String(Math.trunc(timezone.Offset))).slice(-2) + ":" + ("00" + extraOffset).slice(-2);
			if (offset[0] !== "-") {
				offset = "+" + offset;
			}
	
			const date = new sb.Date().setTimezoneOffset(timezone.Offset * 60).format("H:i (Y-m-d)");
			return {
				date,
				offset,
				abbr: timezone.Abbreviation,
				name: timezone.Name,
			};
		}
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
			if (context.user.Data.location) {
				user = context.user;
				coordinates = context.user.Data.location.coordinates;
				skipLocation = context.user.Data.location.hidden;
				place = context.user.Data.location.formatted;
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
				return {
					reply: `My current time is ${sb.Date.now()} 🤖`
				};
			}
			else if (!targetUser.Data.location) {
				return {
					success: false,
					reply: "That user has not set their location!",
					cooldown: 2500
				};
			}
			else {
				user = targetUser;
				coordinates = targetUser.Data.location.coordinates;
				skipLocation = targetUser.Data.location.hidden;
				place = targetUser.Data.location.formatted;
			}
		}
	
		if (coordinates === null) {
			const { results: [geoData] } = await sb.Got.instances.Google({
				url: "geocode/json",
				searchParams: new sb.URLParams()
					.set("address", place)
					.set("key", sb.Config.get("API_GOOGLE_GEOCODING"))
					.toString()
			}).json();
	
			if (!geoData) {
				return {
					success: false,
					reply: "No place matching that query has been found!"
				};
			}
			else {
				coordinates = geoData.geometry.location;
			}
		}
	
		const timeData = await sb.Got.instances.Google({
			url: "timezone/json",
			searchParams: new sb.URLParams()
				.set("timestamp", Math.trunc(sb.Date.now() / 1000).toString())
				.set("location", coordinates.lat + "," + coordinates.lng)
				.set("key", sb.Config.get("API_GOOGLE_TIMEZONE"))
				.toString()
		}).json();
	
		if (timeData.status === "ZERO_RESULTS") {
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
	
		if (user && user.Data.location && !user.Data.location.timezone) {
			user.Data.location.timezone = {
				stringOffset: offset,
				offset: totalOffset,
				name: timeData.timeZoneName
			};
	
			await user.saveProperty("Data");
		}
	
		const replyPlace = (skipLocation) ? "(location hidden)" : place;
		return {
			reply: `${replyPlace} is currently observing ${timeData.timeZoneName}, which is UTC${offset}, and it's ${time.format("H:i (Y-m-d)")} there right now.`
		};
	}),
	Dynamic_Description: null
};