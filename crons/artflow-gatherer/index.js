module.exports = {
	Name: "artflow-gatherer",
	Expression: "0 */5 * * * *",
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

		const [editorData, communityData, ...customData] = await Promise.all(dataPromises);

		const data = [];
		if (editorData.statusCode === 200) {
			data.push(...editorData.body);
		}
		if (communityData.statusCode === 200) {
			data.push(...communityData.body);
		}

		for (let i = 0; i < customData.length; i++) {
			if (customData[i].statusCode === 200) {
				const userID = sb.Config.get("ARTFLOW_AI_CUSTOM_USER_LIST")[i];
				const items = customData[i].body.map(i => ({ ...i, userID }));

				data.push(...items);
			}
		}

		if (data.length === 0) {
			return;
		}

		await sb.Utils.processArtflowData(data);
	})
};
