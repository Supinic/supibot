const throwOrReturn = (throwFlag, message) => {
	if (throwFlag) {
		throw new sb.Error({ message });
	}
	else {
		return {
			success: false,
			reply: message
		};
	}
};

const fetchUserRandomLine = async function (userData, channelData, options = {}) {
	const { throwOnFailure } = options;
	const channelName = channelData.getDatabaseName();

	/** @type {number|null} */
	const userMessageCount = await sb.Query.getRecordset(rs => rs
		.select("Message_Count AS Count")
		.from("chat_data", "Message_Meta_User_Alias")
		.where("User_Alias = %n", userData.ID)
		.where("Channel = %n", channelData.ID)
		.single()
		.flat("Count")
	);

	if (!userMessageCount) {
		return throwOrReturn(throwOnFailure, "That user has not posted any messages in this channel!");
	}

	let randomID;
	const tableHasPlatformID = await sb.Query.isTableColumnPresent("chat_line", channelName, "Platform_ID");
	if (tableHasPlatformID) {
		let userIdentifier;
		const platformData = channelData.Platform;

		if (typeof platformData.fetchInternalPlatformIDByUsername === "function") {
			userIdentifier = platformData.fetchInternalPlatformIDByUsername(userData);
		}
		else if (platformData.Name === "twitch") {
			userIdentifier = userData.Twitch_ID;
		}
		else if (platformData.Name === "discord") {
			userIdentifier = userData.Discord_ID;
		}
		else if (platformData.Name === "cytube") {
			userIdentifier = userData.Name;
		}

		if (!userIdentifier) {
			userIdentifier = userData.Name;
		}

		randomID = await sb.Query.getRecordset(rs => rs
			.select("ID")
			.from("chat_line", channelName)
			.where("Platform_ID = %s", userIdentifier)
			.limit(1)
			.offset(sb.Utils.random(1, userMessageCount) - 1)
			.single()
			.flat("ID")
		);
	}
	else {
		randomID = await sb.Query.getRecordset(rs => rs
			.select("ID")
			.from("chat_line", channelName)
			.where("User_Alias = %n", userData.ID)
			.limit(1)
			.offset(sb.Utils.random(1, userMessageCount) - 1)
			.single()
			.flat("ID")
		);
	}

	if (!randomID) {
		return throwOrReturn(throwOnFailure, "No chat lines found for this user!");
	}

	const randomLine = await sb.Query.getRecordset(rs => rs
		.select("Text", "Posted")
		.from("chat_line", channelName)
		.where("ID >= %n", randomID)
		.orderBy("ID ASC")
		.limit(1)
		.single()
	);

	return {
		success: true,
		text: randomLine.Text,
		date: randomLine.Posted,
		username: userData.Name
	};
};

const fetchChannelRandomLine = async function (channelData, options = {}) {
	const { throwOnFailure } = options;
	const channelName = channelData.getDatabaseName();

	/** @type {number|null} */
	const channelMessageCount = await sb.Query.getRecordset(rs => rs
		.select("MAX(ID) AS Total")
		.from("chat_line", channelName)
		.single()
		.flat("Total")
	);

	if (!channelMessageCount) {
		return throwOrReturn(throwOnFailure, "This channel does not have enough chat lines saved just yet!");
	}

	const tableHasPlatformID = await sb.Query.isTableColumnPresent("chat_line", channelName, "Platform_ID");
	const specificColumns = (tableHasPlatformID) ? ["Platform_ID", "Historic"] : ["User_Alias"];
	const randomLine = await sb.Query.getRecordset(rs => rs
		.select("Text", "Posted", ...specificColumns)
		.from("chat_line", channelName)
		.where("ID >= %n", sb.Utils.random(1, channelMessageCount))
		.orderBy("ID ASC")
		.limit(1)
		.single()
	);

	if (!randomLine) {
		return throwOrReturn(throwOnFailure, "No chat lines found for this user!");
	}

	let username;
	if (randomLine.Platform_ID) {
		username = (randomLine.Historic)
			? randomLine.Platform_ID
			: await channelData.Platform.fetchUsernameByUserPlatformID(randomLine.Platform_ID);

		// Fallback - if no name is available, use the platform IDa or a fallback string if not even that is available
		username ??= `(${randomLine.Platform_ID ?? "unknown"})`;
	}
	else {
		const userData = await sb.User.get(randomLine.User_Alias);
		if (!userData) {
			await sb.Logger.log(
				"Command.Warning",
				"Missing User_Alias",
				channelData,
				{ ID: randomLine.User_Alias }
			);

			username = "(N/A)";
		}
		else {
			username = userData.Name;
		}
	}

	return {
		success: true,
		text: randomLine.Text,
		date: randomLine.Posted,
		username
	};
};

const fetchGroupResult = async function (type, group, userData = null) {
	const promises = group.map(async (channelID) => {
		const channelData = sb.Channel.get(channelID);
		if (type === "user") {
			return await fetchUserRandomLine(userData, channelData, { throwOnFailure: true });
		}
		else {
			return await fetchChannelRandomLine(channelData, { throwOnFailure: true });
		}
	});

	let result;
	try {
		result = await Promise.any(promises);
	}
	catch (e) {
		await sb.Logger.log(
			"Command.Warning",
			`Group $rl error: ${JSON.stringify({ type, group, userData, e })}`
		);

		const [error] = e.errors;
		return {
			success: false,
			reply: error.simpleMessage ?? "An error occured!"
		};
	}

	return result;
};

const fetchGroupUserRandomLine = async function (group, userData) {
	return await fetchGroupResult("user", group, userData);
};

const fetchGroupChannelRandomLine = async function (group) {
	return await fetchGroupResult("channel", group);
};

module.exports = {
	fetchChannelRandomLine,
	fetchUserRandomLine,
	fetchGroupUserRandomLine,
	fetchGroupChannelRandomLine
};
