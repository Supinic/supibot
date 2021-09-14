module.exports = {
	Name: "artflow",
	Aliases: ["rafi","randomartflowimage"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches a random Artflow.ai image along with the prompt that was used to generate it.",
	Flags: ["mention","non-nullable","pipe","skip-banphrase"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		generationUserID: "5555-7f7f-4747-a44b"
	})),
	Code: (async function artflow (context, word) {
		if (context.params.prompt) {
			return {
				success: false,
				reply: `Prompt generation is currently being tested, and should be available soon!`
			};
		}

		if (context.params.prompt) {
			this.data.pendingRequests ??= [];
			const pending = this.data.pendingRequests.find(i => i.author === context.user.ID);
			if (!pending) {
				return {
					success: false,
					reply: `You already have a pending request!`
				};
			}

			const artflowUserID = this.staticData.generationUserID;
			const formData = new sb.Got.formData();
			formData.append("user_id_val", artflowUserID);
			formData.append("text_prompt", context.params.prompt);

			const response = sb.Got("FakeAgent", {
				url: "https://artflow.ai/add_to_generation_queue",
				headers: {
					"x-requested-with": "XMLHttpRequest",
					...formData.getHeaders()
				},
				body: formData.getBuffer(),
				referrer: "https://artflow.ai/"
			});

			if (response.statusCode !== 200) {
				return {
					success: false,
					reply: `Image generation did not succeed! Please try again later.`
				};
			}

			this.data.pendingRequests.push({
				user: context.user.ID,
				channel: context.channel?.ID ?? null,
				platform: context.platform?.ID ?? null,
				imageIndex: response.body.index,
				prompt: context.params.prompt,
				interval: setInterval(async function () {
					const imageIndex = this.imageIndex;
					const formData = new sb.Got.formData();
					formData.append("my_work_id", imageIndex);

					const check = await sb.Got("FakeAgent", {
						url: "https://artflow.ai/check_status",
						headers: {
							"x-requested-with": "XMLHttpRequest",
							...formData.getHeaders()
						},
						body: formData.getBuffer(),
						referrer: "https://artflow.ai/"
					});

					if (check.statusCode !== 200) {
						return; // api failed
					}
					else if (check.body.current_rank > -1) {
						return; // still pending
					}

					const [result] = await sb.Utils.processArtflowData([{
						filename: check.body.filename,
						userID: artflowUserID,
						text_prompt: this.prompt,
						index: imageIndex,
						status: "Finished"
					}]);

					clearInterval(this.interval);

					await sb.Reminder.create({
						Channel: null,
						User_From: 1127,
						User_To: this.user,
						Text: `Your Artflow prompt "${this.prompt} has finished: ${result.link}`,
						Schedule: null,
						Created: new sb.Date(),
						Private_Message: true,
						Platform: this.platform ?? 1
					}, true);
				}, 300_000)
			});

			const range = [
				Math.trunc(response.body.queue_length / 30),
				Math.trunc(response.body.queue_length / 12)
			];

			return {
				reply: sb.Utils.tag.trim `
					Your Artflow image will be ready in around ${range[0]} to ${range[1]} minutes. 
					You will receive a system reminder when it is finished
				`
			};
		}

		const imageData = await sb.Query.getRecordset(rs => {
			rs.select("Prompt", "Upload_Link")
				.from("data", "Artflow_Image", "Added")
				.orderBy("RAND()")
				.limit(1)
				.single();

			if (word) {
				rs.where("Prompt %*like*", word.toLowerCase());
			}

			return rs;
		});

		if (!imageData) {
			return {
				success: false,
				reply: `No image has been found!`
			};
		}

		const postedDelta = (imageData.Added)
			? `(posted ${sb.Utils.timeDelta(imageData.Added)})`
			: "";

		return {
			reply: `Your random prompt "${imageData.Prompt}": ${imageData.Upload_Link} ${postedDelta}`
		};
	}),
	Dynamic_Description: (async (prefix) => [
		`Fetches a random <a href="//artflow.ai">Artflow.ai</a> image along with the prompt that was used to generate it.`,
		"This command does NOT generate new things, it only posts pictures that others have created.",
		"",

		`<code>${prefix}artflow</code>`,
		"Posts a random picture with a random prompt.",
		"",

		`<code>${prefix}artflow (single word)</code>`,
		"Posts a random picture where the prompt includes your chosen word.",
		"",

		`<code>${prefix}artflow prompt:(single word)</code>`,
		`<code>${prefix}artflow prompt:"multiple word prompt"code>`,
		"Creates an Artflow-generated picture based on your prompt.",
		"This might take a long time, so you will only be notified via a reminder when it is finished.",
		"Each user can only have one request pending at a time.",
		""
	])
};
