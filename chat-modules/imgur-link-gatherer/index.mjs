export const definition = {
	Name: "imgur-link-gatherer",
	Events: ["message"],
	Description: "Gathers Imgur links across channels, and reuploads them if possible.",
	Code: (async function gatherImgurLinks (context) {
		const supportedExtensions = ["jpg", "jpeg", "png", "gif", "mp4"];
		const regex = /(https:\/\/)?(i\.)?imgur\.com\/(?<slug>\w{5,8})\.(?<extension>\w{3,4})/g;
		const matches = [...context.message.matchAll(regex)];
		if (matches.length === 0) {
			return;
		}

		this.data.processedLinks ??= new Set();

		for (const match of matches) {
			const { extension, slug } = match.groups;
			if (!supportedExtensions.includes(extension)) {
				return;
			}
			else if (this.data.processedLinks.has(slug)) {
				return;
			}

			this.data.processedLinks.add(slug);

			const link = `${slug}.${extension}`;
			const row = await sb.Query.getRow("data", "Imgur_Reupload");
			await row.load(link, true);
			if (row.loaded) {
				return;
			}

			const formData = new sb.Got.FormData();
			formData.append("reqtype", "urlupload");
			formData.append("url", `https://i.imgur.com/${link}`);

			let uploaded;
			let catboxReupload;
			try {
				const response = await sb.Got("GenericAPI", {
					url: "https://catbox.moe/user/api.php",
					method: "POST",
					throwHttpErrors: false,
					headers: {
						...formData.getHeaders()
					},
					body: formData.getBuffer(),
					retry: {
						limit: 0
					},
					timeout: {
						request: 10_000
					}
				});

				if (response.ok) {
					catboxReupload = response.body.match("\.moe\/(.+)$")[1];
					uploaded = true;
				}
				else {
					catboxReupload = null;
					uploaded = false;
				}
			}
			catch (e) {
				catboxReupload = null;
				uploaded = false;
			}

			row.setValues({
				Imgur: link,
				Catbox: catboxReupload,
				Waiting: !uploaded,
				Channel: context.channel.ID
			});

			await row.save({ skipLoad: true });
		}
	}),
	Global: true,
	Platform: null
};
