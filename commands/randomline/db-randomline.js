const fetchUserRandomLine = async function (userData, channelData) {
	const channelName = channelData.getDatabaseName();

	/** @type {number|null} */
	const userMessageCount = await sb.Query.getRecordset(rs => rs
		.select("Message_Count AS Count")
		.from("chat_data", "Message_Meta_User_Alias")
		.where("User_Alias = %n", userData.ID)
		.where("Channel = %n", channelData)
		.single()
		.flat("Count")
	);

	if (!userMessageCount) {
		return {
			success: false,
			reason: "That user has not posted any messages in this channel!"
		};
	}

	const randomID = await sb.Query.getRecordset(rs => rs
		.select("ID")
		.from("chat_line", channelName)
		.where("User_Alias = %n", userData.ID)
		.limit(1)
		.offset(sb.Utils.random(1, userMessageCount) - 1)
		.single()
		.flat("ID")
	);

	if (!randomID) {
		return {
			success: false,
			reason: "No chat lines found for this user!"
		};
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

const fetchChannelRandomLine = async function (channelData) {
	const channelName = channelData.getDatabaseName();

	/** @type {number|null} */
	const channelMessageCount = await sb.Query.getRecordset(rs => rs
		.select("MAX(ID) AS Total")
		.from("chat_line", channelName)
		.single()
		.flat("Total")
	);

	if (!channelMessageCount) {
		return {
			success: false,
			reason: "This channel does not have enough chat lines saved just yet!"
		};
	}

	const tableHasPlatformID = await sb.Query.isTableColumnPresent("chat_line", channelName, "Platform_ID");
	const userIdentifierColumn = (tableHasPlatformID) ? "Platform_ID" : "User_Alias";
	const randomLine = await sb.Query.getRecordset(rs => rs
		.select("Text", "Posted", userIdentifierColumn)
		.from("chat_line", channelName)
		.where("ID >= %n", sb.Utils.random(1, channelMessageCount))
		.orderBy("ID ASC")
		.limit(1)
		.single()
	);

	if (!randomLine) {
		return {
			success: false,
			reason: "No chat lines found for this user!"
		};
	}

	let username;
	if (randomLine.Platform_ID) {
		username = await channelData.Platform.fetchUsernameByUserPlatformID(randomLine.Platform_ID);
	}
	else {
		const userData = await sb.User.get(randomLine.User_Alias);
		username = userData.Name;
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
			return await fetchUserRandomLine(userData, channelData);
		}
		else {
			return await fetchChannelRandomLine(channelData);
		}
	});

	const partialResults = await Promise.all(promises);
	const filteredResults = partialResults.filter(i => i.success === true);
	if (filteredResults.length === 0) {
		return {
			success: false,
			reply: partialResults[0].reason
		};
	}

	return sb.Utils.randArray(partialResults.filter(i => i.success === true));
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
