import { type SupiDate, SupiError } from "supi-core";
import { randomInt } from "../../utils/command-utils.js";
import type { User } from "../../classes/user.js";
import type { Channel } from "../../classes/channel.js";
import type { ResultFailure } from "../../classes/command.js";

type RandomLine = {
	success: true,
	text: string;
	username: string;
	date: SupiDate;
};

export const fetchUserRandomLine = async (userData: User, channelData: Channel): Promise<ResultFailure | RandomLine> => {
	const channelName = channelData.getDatabaseName();
	const userMessageCount = await core.Query.getRecordset<number | null>(rs => rs
		.select("Message_Count AS Count")
		.from("chat_data", "Message_Meta_User_Alias")
		.where("User_Alias = %n", userData.ID)
		.where("Channel = %n", channelData.ID)
		.single()
		.flat("Count")
	);

	if (!userMessageCount) {
		return {
			success: false,
			reply: "That user has not posted any messages in this channel!"
		};
	}

	let randomID: number | null;
	const tableHasPlatformID = await core.Query.isTableColumnPresent("chat_line", channelName, "Platform_ID");
	if (tableHasPlatformID) {
		const platformData = channelData.Platform;
		const userIdentifier = platformData.fetchInternalPlatformIDByUsername(userData) ?? userData.Name;

		randomID = await core.Query.getRecordset<number | null>(rs => rs
			.select("ID")
			.from("chat_line", channelName)
			.where("Platform_ID = %s", userIdentifier)
			.limit(1)
			.offset(randomInt(1, userMessageCount) - 1)
			.single()
			.flat("ID")
		);
	}
	else {
		randomID = await core.Query.getRecordset<number | null>(rs => rs
			.select("ID")
			.from("chat_line", channelName)
			.where("User_Alias = %n", userData.ID)
			.limit(1)
			.offset(randomInt(1, userMessageCount) - 1)
			.single()
			.flat("ID")
		);
	}

	if (!randomID) {
		return {
			success: false,
			reply: "No chat lines found for this user!"
		};
	}

	const randomLine = await core.Query.getRecordset<{ Text: string; Posted: SupiDate; } | undefined>(rs => rs
		.select("Text", "Posted")
		.from("chat_line", channelName)
		.where("ID >= %n", randomID)
		.orderBy("ID ASC")
		.limit(1)
		.single()
	);

	if (!randomLine) {
		throw new SupiError({
			message: "Assert error: Randomly rolled chat line ID does not exist",
			args: { randomID, channelName }
		});
	}

	return {
		success: true,
		text: randomLine.Text,
		date: randomLine.Posted,
		username: userData.Name
	};
};

export const fetchChannelRandomLine = async function (channelData: Channel): Promise<ResultFailure | RandomLine> {
	const channelName = channelData.getDatabaseName();

	const channelMessageCount = await core.Query.getRecordset<number | null>(rs => rs
		.select("MAX(ID) AS Total")
		.from("chat_line", channelName)
		.single()
		.flat("Total")
	);

	if (!channelMessageCount) {
		return {
			success: false,
			reply: "This channel does not have enough chat lines saved just yet! Try again in a minute or so."
		};
	}

	type RandomLine = {
		Text: string;
		Posted: SupiDate;
		Platform_ID: string;
		Historic: boolean;
	};

	const randomLine = await core.Query.getRecordset<RandomLine | undefined>(rs => rs
		.select("Text", "Posted", "Platform_ID")
		.from("chat_line", channelName)
		.where("ID >= %n", randomInt(1, channelMessageCount))
		.orderBy("ID ASC")
		.limit(1)
		.single()
	);

	if (!randomLine) {
		return {
			success: false,
			reply: "No chat lines found for this user!"
		};
	}

	const username = await channelData.Platform.fetchUsernameByUserPlatformID(randomLine.Platform_ID) ?? `(${randomLine.Platform_ID})`;
	return {
		success: true,
		text: randomLine.Text,
		date: randomLine.Posted,
		username
	};
};
