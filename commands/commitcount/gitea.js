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

	let response;
	try {
		response = await sb.Got("GenericAPI", {
			url: `https://${host}/api/v1/users/${username}/heatmap`,
			throwHttpErrors: false
		});
	}
	catch (e) {
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
	const standardTimestamp = new sb.Date(threshold).valueOf() / 1000;

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

module.exports = {
	execute
};
