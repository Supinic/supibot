import * as z from "zod";
import { SupiDate } from "supi-core";
import type { CronDefinition } from "../index.js";

let isTableAvailable: boolean | undefined;
let latestID: number | undefined;
const linkSchema = z.object({ data: z.object({ link: z.string() }) });
const flagsSchema = z.object({ skipPrivateReminders: z.boolean().optional() });

type ChangelogRow = { ID: number; Created: SupiDate; Title: string; Type: string; Description: string; };
type SubData = { User_Alias: number; Platform: number | null; Flags: string | null; Channel: number | null; };

export default {
	name: "changelog-announcer",
	expression: "0 */30 * * * *",
	description: "Watches for new changelogs, and if found, posts them to the specified channel(s).",
	code: (async function changelogAnnouncer () {
		isTableAvailable ??= await core.Query.isTablePresent("data", "Event_Subscription");
		if (!isTableAvailable) {
			this.stop();
			return;
		}

		if (typeof latestID !== "number") {
			latestID = await core.Query.getRecordset<number>(rs => rs
				.select("MAX(ID) AS Max")
				.from("data", "Changelog")
				.single()
				.flat("Max")
			);

			return;
		}

		const finalId = latestID;
		const data = await core.Query.getRecordset<ChangelogRow[]>(rs => rs
			.select("ID", "Created", "Title", "Type", "Description")
			.from("data", "Changelog")
			.where("ID > %n", finalId)
		);

		if (data.length === 0) {
			return;
		}

		latestID = Math.max(...data.map(i => i.ID));

		const subscriptions = await core.Query.getRecordset<SubData[]>(rs => rs
			.select("User_Alias", "Platform", "Channel", "Flags")
			.from("data", "Event_Subscription")
			.where("Type = %s", "Changelog")
			.where("Active = %b", true)
		);

		if (subscriptions.length > 0) {
			let message;
			if (data.length === 1) {
				const link = `https://supinic.com/data/changelog/detail/${data[0].ID}`;
				message = `New changelog entry detected! ${data[0].Type}: ${data[0].Title} Detail: ${link}`;
			}
			else {
				const params = data.map(i => `ID=${i.ID}`).join("&");
				const relay = await core.Got.get("Supinic")({
					method: "POST",
					url: "relay",
					throwHttpErrors: false,
					json: {
						url: `/data/changelog/lookup?${params}`
					}
				});

				let link;
				if (relay.statusCode === 200) {
					link = linkSchema.parse(relay.body).data.link;
				}
				else {
					link = `Multiple IDs: ${data.map(i => i.ID).join(", ")}`;
				}

				message = `New changelog entries detected! Details: ${link}`;
			}

			for (const sub of subscriptions) {
				const flags = flagsSchema.parse(JSON.parse(sub.Flags ?? "{}"));
				if ("skipPrivateReminder" in flags && flags.skipPrivateReminder === true) {
					const platform = sb.Platform.getAsserted(sub.Platform ?? 1);
					if (sub.Channel) {
						const channelData = sb.Channel.getAsserted(sub.Channel, platform);
						await platform.send(message, channelData);
					}
				}
				else {
					await sb.Reminder.create({
						Channel: null,
						User_From: 1127,
						User_To: sub.User_Alias,
						Text: message,
						Schedule: null,
						Private_Message: true,
						Platform: sub.Platform ?? 1,
						Created: new SupiDate(),
						Type: "Reminder"
					}, true);
				}
			}
		}

		const discord = sb.Platform.getAsserted("discord");
		const discordUpdatesRole = "748957148439904336";
		const channelData = sb.Channel.getAsserted("748955843415900280", discord);
		for (const item of data) {
			const embed = {
				title: item.Type,
				url: `https://supinic.com/data/changelog/detail/${item.ID}`,
				description: `<@&${discordUpdatesRole}>`,
				timestamp: new SupiDate(item.Created).format("Y-m-d H:i:s"),
				fields: [
					{
						name: "Title",
						value: item.Title
					}
				]
			};

			if (item.Description) {
				embed.fields.push({
					name: "Description",
					value: item.Description
				});
			}

			await discord.send(null, channelData, {
				embeds: [embed]
			});
		}
	})
} satisfies CronDefinition;
