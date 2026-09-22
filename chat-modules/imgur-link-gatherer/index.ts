import * as z from "zod";
import { defineChatModule } from "../../classes/chat-module.js";
import { typeRegexGroups } from "../../utils/ts-helpers.js";

let missingEnvNotified = false;
const SUPPORTED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "mp4"]);
const uploadSchema = z.object({
	data: z.object({
		url: z.string()
	})
});

const regex = /(https:\/\/)?(i\.)?imgur\.com\/(?<slug>\w{5,8})\.(?<extension>\w{3,4})/g;

export default defineChatModule({
	name: "imgur-link-gatherer",
	description: "Gathers Imgur links globally, and reuploads them if possible.",
	platform: "all",
	scope: "global",
	state: () => ({ links: new Set<string>() }),
	handlers: {
		async message (context, { state }) {
			if (!process.env.API_IMGBB) {
				if (missingEnvNotified) {
					missingEnvNotified = true;
					console.warn("No ImgBB key notified (API_IMGBB)");
				}

				return;
			}

			const matches = [...context.message.matchAll(regex)];
			if (matches.length === 0) {
				return;
			}

			for (const match of matches) {
				const { groups } = match;
				if (!groups) {
					continue;
				}

				const { extension, slug } = typeRegexGroups<"slug" | "extension">(groups);
				if (!SUPPORTED_EXTENSIONS.has(extension)) {
					return;
				}
				else if (state.links.has(slug)) {
					return;
				}

				state.links.add(slug);

				const link = `${slug}.${extension}`;
				const row = await core.Query.getRow("data", "Imgur_Reupload");
				await row.load(link, true);
				if (row.loaded) {
					return;
				}

				const formData = new FormData();
				formData.append("image", `https://i.imgur.com/${link}`);

				let uploaded;
				let imgbbReupload;
				try {
					const response = await core.Got.get("GenericAPI")({
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
						const { data } = uploadSchema.parse(response.body);
						imgbbReupload = data.url.replace("https://i.ibb.co/", "");
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
		}
	}
});
