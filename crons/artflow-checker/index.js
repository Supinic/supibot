module.exports = {
	Name: "artflow-checker",
	Expression: "*/30 * * * * *",
	Description: "Checks active artflow.ai requests created by users, and determines their status",
	Defer: (() => ({
		start: 0,
		end: 5000
	})),
	Type: "Bot",
	Code: (async function artflowChecker () {
		const activePrompts = await sb.Cache.server.hgetall("artflow");
		if (!activePrompts || Object.keys(activePrompts).length === 0) {
			return;
		}

		for (const [key, rawValue] of Object.entries(activePrompts)) {
			const value = (typeof rawValue === "string") ? JSON.parse(rawValue) : rawValue;
			const formData = new sb.Got.FormData();
			formData.append("my_work_id", value.imageIndex);

			const check = await sb.Got("FakeAgent", {
				method: "POST",
				url: "https://artflow.ai/check_status",
				headers: {
					"x-requested-with": "XMLHttpRequest",
					...formData.getHeaders()
				},
				body: formData.getBuffer(),
				referrer: "https://artflow.ai/"
			});

			const reminderData = {
				Channel: null,
				User_From: 1127,
				User_To: value.user,
				Schedule: null,
				Created: new sb.Date(),
				Private_Message: true,
				Platform: value.platform ?? 1
			};

			const statusCodeDigit = Math.trunc(check.statusCode / 100);
			if (statusCodeDigit === 5) { // 5xx response, API failed - ignore
				return;
			}
			else if (statusCodeDigit === 4 || check.statusCode !== 200) { // 4xx or other non-200 response
				console.warn("Unknown status code", {
					body: check.body,
					code: check.statusCode
				});

				reminderData.Text = `Your Artflow prompt "${value.prompt}" has failed with status code ${check.statusCode}! Please try again.`;
				await sb.Reminder.create(reminderData, true);

				await sb.Cache.server.hdel("artflow", key);
				return;
			}
			else if (check.body.current_rank > -1) { // still pending
				value.queue = check.body.current_rank;
				await sb.Cache.server.hset("artflow", key, JSON.stringify(value));

				return;
			}

			const [result] = await sb.Utils.processArtflowData([{
				filename: check.body.filename,
				userID: value.artflowUserID,
				text_prompt: value.prompt,
				index: value.imageIndex,
				status: "Finished"
			}]);

			if (result.link) {
				reminderData.Text = `Your Artflow prompt "${value.prompt}" has finished: ${result.link}`;
			}
			else {
				reminderData.Text = `Your Artflow prompt "${value.prompt}" failed with this reason: ${result.reason}`;
			}

			await sb.Reminder.create(reminderData, true);
			await sb.Cache.server.hdel("artflow", key);
		}
	})
};
