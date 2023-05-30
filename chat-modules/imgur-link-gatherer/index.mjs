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

			row.setValues({
				Imgur: link,
				Waiting: true
			});

			await row.save({ skipLoad: true });
		}
	}),
	Global: true,
	Platform: null
};
