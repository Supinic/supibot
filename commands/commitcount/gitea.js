import { SupiDate } from "supi-core";

const execute = async (data) => {
	const {
		username,
		threshold,
		host
	} = data;

	if (!host) {
		return {
			success: false,
			reply: `You must provide your Gitea host name!`
		};
	}
	else if (!username) {
		return {
			success: false,
			reply: `You must provide a Gitea username!`
		};
	}

	let response;
	try {
		response = await core.Got.get("GenericAPI")({
			url: `https://${host}/api/v1/users/${username}/heatmap`,
			throwHttpErrors: false
		});
	}
	catch {
		return {
			success: false,
			reply: `Could not query your provided host!`
		};
	}

	if (!response.ok) {
		return {
			success: false,
			reply: `Could not fetch commit data! Reason: ${response.body.message ?? "N/A"}`
		};
	}

	let commitCount = 0;
	const standardTimestamp = new SupiDate(threshold).valueOf() / 1000;

	for (const item of response.body) {
		if (item.timestamp >= standardTimestamp) {
			commitCount += item.contributions;
		}
	}

	return {
		success: true,
		commitCount
	};
};

export default {
	name: "gitea",
	prettyName: "Gitea",
	execute
};
