let missingEnvNotified = false;
const SUPPORTED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "mp4"]);

export const definition = {
	Name: "imgur-link-gatherer",
	Events: ["message"],
	Description: "Gathers Imgur links across channels, and reuploads them if possible.",
	Code: (async function gatherImgurLinks (context) {
		if (!process.env.API_IMGBB) {
			if (missingEnvNotified) {
				missingEnvNotified = true;
				console.warn("No ImgBB key notified (API_IMGBB)");
			}

			return;
		}

		const regex = /(https:\/\/)?(i\.)?imgur\.com\/(?<slug>\w{5,8})\.(?<extension>\w{3,4})/g;
		const matches = [...context.message.matchAll(regex)];
		if (matches.length === 0) {
			return;
		}

		this.data.processedLinks ??= new Set();

		for (const match of matches) {
			const { extension, slug } = match.groups;
			if (!SUPPORTED_EXTENSIONS.has(extension)) {
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

			const formData = new FormData();
			formData.append("image", `https://i.imgur.com/${link}`);

			let uploaded;
			let imgbbReupload;
			try {
				const response = await sb.Got.get("GenericAPI")({
					url: "https://api.imgbb.com/1/upload",
					searchParams: {
						key: process.env.API_IMGBB
					},
					method: "POST",
					throwHttpErrors: false,
					body: formData,
					retry: {
						limit: 0
					},
					timeout: {
						request: 10_000
					}
				});

				if (response.ok) {
					imgbbReupload = response.body.data.url.replace("https://i.ibb.co/", "");
					uploaded = true;
				}
				else {
					imgbbReupload = null;
					uploaded = false;
				}
			}
			catch {
				imgbbReupload = null;
				uploaded = false;
			}

			row.setValues({
				Imgur: link,
				Other: imgbbReupload,
				Waiting: !uploaded,
				Channel: context.channel.ID
			});

			await row.save({ skipLoad: true });
		}
	}),
	Global: true,
	Platform: null
};
