export default {
	reloadAll: async () => {
		await sb.Channel.reloadData();
		return {
			statusCode: 200,
			data: { message: "OK" }
		};
	},
	reloadSpecific: async (req, res, url) => {
		const IDs = url.searchParams.getAll("ID").map(Number).filter(Boolean);
		const result = await sb.Reminder.reloadSpecific(...IDs);

		const [active, inactive] = sb.Utils.splitByCondition(IDs, i => sb.Reminder.get(i));
		return {
			statusCode: 200,
			data: {
				processedIDs: IDs,
				active,
				inactive,
				result
			}
		};
	},
	unset: async (req, res, url) => {
		const user = url.searchParams.get("user");
		if (!user) {
			return {
				statusCode: 400,
				error: { message: "No user name provided" }
			};
		}

		const rawId = url.searchParams.get("id");
		const id = Number(rawId);
		if (!rawId || !sb.Utils.isValidInteger(id)) {
			return {
				statusCode: 400,
				error: { message: "No or malformed reminder ID provided" }
			};
		}

		/** @type {Reminder | null} */
		const reminder = sb.Reminder.get(id);
		if (!reminder) {
			return {
				statusCode: 400,
				error: { message: "Reminder does not exist or has already been deactivated" }
			};
		}

		const userData = await sb.User.get(user, true);
		if (!userData) {
			return {
				statusCode: 400,
				error: { message: "User does not exist" }
			};
		}

		if (reminder.User_From !== userData.ID && reminder.User_To !== userData.ID) {
			return {
				statusCode: 400,
				error: { message: "Provided user is not the author nor the target of provided reminder" }
			};
		}

		await reminder.deactivate(true, true);

		return {
			statusCode: 200,
			data: { message: "OK" }
		};
	}
};
