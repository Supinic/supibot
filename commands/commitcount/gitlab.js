const execute = async (data) => {
	const {
		username,
		threshold,
		host
	} = data;

	if (!host) {
		return {
			success: false,
			reply: `You must provide your GitLab host name!`
		};
	}

	let response;
	try {
		response = await sb.Got("GenericAPI", {
			url: `https://${host}/users/${username}/calendar.json`,
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
	const thresholdDate = new sb.Date(threshold.format("Y-m-d"));
	for (const [date, contributions] of Object.entries(response.body)) {
		const dateStamp = new sb.Date(date);
		if (dateStamp >= thresholdDate) {
			commitCount += contributions;
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
