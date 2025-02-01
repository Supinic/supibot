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
	else if (!username) {
		return {
			success: false,
			reply: `You must provide a GitLab username!`
		};
	}

	let response;
	try {
		response = await sb.Got.get("GenericAPI")({
			url: `https://${host}/users/${username}/calendar.json`,
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

export default {
	name: "gitlab",
	prettyName: "GitLab",
	execute
};
