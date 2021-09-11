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

		for (const item of data) {
			const row = await sb.Query.getRow("data", "Artflow_Image");
			await row.load(item.filename, true);
			if (row.loaded) { // Image already exists in the database
				continue;
			}

			if (item.status === "Queuing") { // Image currently being processed, skip
				continue;
			}

			let imageURL = `https://artflowbucket.s3.amazonaws.com/generated/${item.index}.webp`;
			const indexResponse = await sb.Got("FakeAgent", {
				method: "HEAD",
				url: imageURL,
				throwHttpErrors: false,
				responseType: "text"
			});

			if (indexResponse.statusCode !== 200) {
				imageURL = `https://artflowbucket-new.s3.amazonaws.com/generated/${item.filename}.webp`;

				const filenameResponse = await sb.Got("FakeAgent", {
					method: "HEAD",
					url: imageURL,
					throwHttpErrors: false,
					responseType: "text"
				});

				if (filenameResponse.statusCode !== 200) {
					imageURL = null;
				}
			}

			if (!imageURL) { // File does not exist anymore
				continue;
			}

			const formData = new sb.Got.FormData();
			formData.append("reqtype", "urlupload");
			formData.append("url", imageURL);

			const uploadResponse = await sb.Got({
				url: "https://catbox.moe/user/api.php",
				method: "POST",
				throwHttpErrors: false,
				headers: {
					...formData.getHeaders()
				},
				body: formData.getBuffer(),
				retry: 0,
				timeout: 10000
			});

			if (uploadResponse.statusCode !== 200) { // Upload failed
				continue;
			}

			row.setValues({
				Filename: item.filename,
				ID: item.index,
				User_ID: item.userID ?? null,
				Prompt: item.text_prompt ?? null,
				Upload_Link: uploadResponse.body
			});

			await row.save({
				ignore: true,
				skipLoad: true
			});
		}
	})
};
