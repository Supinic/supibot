import { SupiDate } from "supi-core";
import { defineChatModule } from "../../classes/chat-module.js";
import { typeRegexGroups } from "../../utils/ts-helpers.js";

type SourceRow = {
	ID: number;
	Host: string;
	Slug: string;
	Extension: string;
};
type SeenRow = {
	Source_ID: SourceRow["ID"];
	Platform: "twitch" | "discord";
	Channel: string;
	User: string;
	Seen: SupiDate;
};

type ImageHostDefinition = {
	name: string;
	hostnames: readonly string[];
	slugPattern: string;
	extensions: readonly string[];
};
const BASE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "mp4"];
const HOSTS_DEFINITIONS = [
	{
		name: "imgur",
		hostnames: ["imgur.com", "i.imgur.com"],
		slugPattern: "[A-Za-z0-9]{5,8}",
		extensions: BASE_EXTENSIONS
	},
	{
		name: "nuuls",
		hostnames: ["i.nuuls.com"],
		slugPattern: "[A-Za-z0-9]{5}",
		extensions: BASE_EXTENSIONS
	},
	{
		name: "kappa",
		hostnames: ["kappa.lol"],
		slugPattern: "[A-Za-z0-9]{5}",
		extensions: []
	}
] as const satisfies readonly ImageHostDefinition[];

const createLinkRegex = (host: ImageHostDefinition): RegExp => {
	let body;
	const hostnames = host.hostnames.map(i => RegExp.escape(i)).join("|");
	if (host.extensions.length === 0) {
		body = String.raw `(?<![\w.-])(?:https?:\/\/)?(?:${hostnames})\/(?<slug>${host.slugPattern})`;
	}
	else {
		const extensions = host.extensions.map(i => RegExp.escape(i)).join("|");
		body = String.raw `(?<![\w.-])(?:https?:\/\/)?(?:${hostnames})\/(?<slug>${host.slugPattern})\.(?<extension>${extensions})(?=$|[/?#\s])`;
	}

	return new RegExp(body, "gi");
};
const matchers = HOSTS_DEFINITIONS.map(host => ({
	host,
	regex: createLinkRegex(host)
}));

export default defineChatModule({
	name: "link-gatherer",
	description: "Gathers media links globally, and creates a database record for each occurrence.",
	platform: ["twitch", "discord"],
	scope: "platform",
	handlers: {
		async message (context) {
			const { user, platform, channel } = context;
			if (!user) {
				return;
			}

			for (const { host, regex } of matchers) {
				for (const match of context.message.matchAll(regex)) {
					const { slug, extension = "" } = typeRegexGroups<"slug", "extension">(match);
					if (!slug) {
						continue;
					}
					if (host.extensions.length !== 0 && !extension) {
						continue;
					}

					let sourceId = await core.Query.getRecordset<number | undefined>(rs => rs
						.select("ID")
						.from("data", "Media_Source")
						.where("Host = %s", host.name)
						.where("Slug = %s", slug)
						.where("Extension = %s", extension)
						.flat("ID")
						.single()
					);
					if (typeof sourceId === "undefined") {
						const row = await core.Query.getRow<SourceRow>("data", "Media_Source");
						row.setValues({
							Host: host.name,
							Slug: slug,
							Extension: extension
						});

						await row.save();
						sourceId = row.values.ID;
					}

					const userId = (platform.name === "twitch") ? user.Twitch_ID : user.Discord_ID;
					const seenRow = await core.Query.getRow<SeenRow>("data", "Media_Seen");
					seenRow.setValues({
						Source_ID: sourceId,
						Platform: platform.name,
						Channel: (platform.name === "twitch") ? (channel.Specific_ID ?? channel.Name) : channel.Name,
						User: userId ?? String(user.ID),
						Seen: new SupiDate()
					});
					await seenRow.save({ skipLoad: true });
				}
			}
		}
	}
});
