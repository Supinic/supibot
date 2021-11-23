module.exports = {
	Name: "artflow-gatherer",
	Expression: "0 0 * * * *",
	Description: "Collects image data from artflow.ai",
	Defer: (() => ({
		start: 0,
		end: 30000
	})),
	Type: "Bot",
	Code: (async function artflowGatherer () {
		const get = sb.Got.extend({
			method: "POST",
			prefixUrl: "https://artflow.ai",
			responseType: "json",
			timeout: 60_000,
			retry: 0,
			throwHttpErrors: false
		});

		const dataPromises = [
			get("show_editor_choice"),
			get("show_community_work")
		];

		if (sb.Config.has("ARTFLOW_AI_CUSTOM_USER_LIST", true)) {
			for (const userID of sb.Config.get("ARTFLOW_AI_CUSTOM_USER_LIST")) {
				const formData = new sb.Got.FormData();
				formData.append("user_id_val", userID);

				const customPromise = get({
					url: "show_my_work",
					headers: formData.getHeaders(),
					body: formData.getBuffer()
				});

				dataPromises.push(customPromise);
			}
		}

		const [editorData, communityData, ...customData] = await Promise.allSettled(dataPromises);

		const data = [];
		if (editorData.status === "fulfilled" && editorData.value.statusCode === 200) {
			data.push(...editorData.value.body);
		}
		if (communityData.status === "fulfilled" && communityData.value.statusCode === 200) {
			data.push(...communityData.value.body);
		}

		const userIDList = sb.Config.get("ARTFLOW_AI_CUSTOM_USER_LIST");
		for (let i = 0; i < customData.length; i++) {
			if (customData[i].status === "fulfilled" && customData[i].value.statusCode === 200) {
				const userID = userIDList[i];
				const items = customData[i].value.body.map(i => ({ ...i, userID }));

				data.push(...items);
			}
		}

		if (data.length === 0) {
			return;
		}

		const preparedData = data.map(i => ({
			...i,
			textPrompt: i.text_prompt
		}));

		await sb.Utils.processArtflowData(preparedData);
	})
};
