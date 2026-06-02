import type { SupiDate } from "supi-core";
import { declare } from "../../classes/command.js";
import { createRelayLink } from "../../utils/command-utils.js";

type EmoteData = {
	ID: string;
	emoteId: string;
	text: string;
	tier: string | null;
	type: string;
	todo: boolean;
	added: SupiDate | null;
	deleted: SupiDate | null;
	author: number;
};

export default declare({
	Name: "origin",
	Aliases: null,
	Cooldown: 10000,
	Description: "Fetches the origin of a given emote.",
	Flags: ["mention", "pipe"],
	Params: [{ name: "index", type: "number" }],
	Whitelist_Response: null,
	Code: (async function origin (context, emote) {
		if (!emote) {
			return {
				success: true,
				reply: "Check the emote origin list here: https://supinic.com/data/origin/list"
			};
		}

		const contextEmote = await context.getBestAvailableEmote([emote], "", { returnEmoteObject: true });
		const contextEmoteID = (contextEmote?.ID) ? String(contextEmote.ID) : null;
		let emoteData = await core.Query.getRecordset<EmoteData[]>(rs => {
			rs.select("ID", "Emote_ID AS emoteId", "Text AS text", "Tier AS tier", "Type AS type", "Todo AS todo")
				.select("Emote_Added AS added", "Emote_Deleted AS deleted", "Author AS author")
				.from("data", "Origin")
				.where("Name COLLATE utf8mb4_bin LIKE %s", emote)
				.where("Replaced = %b", false);

			if (contextEmoteID) {
				rs.orderBy(`CASE WHEN Emote_ID = '${core.Query.escapeString(contextEmoteID)}' THEN -1 ELSE 1 END`);
			}

			return rs;
		});

		if (emoteData.length === 0) {
			// Self-protection: Don't make a fulltext search and then a relay for too short of a query
			if (emote.length < 4) {
				return {
					success: false,
					reply: "No definitions found for given query!"
				};
			}

			const fallbackEmoteData = await core.Query.getRecordset<EmoteData[]>(rs => rs
				.select("ID", "Emote_ID AS emoteId", "Text AS text", "Tier AS tier", "Type AS type", "Todo AS todo")
				.select("Emote_Added AS added", "Emote_Deleted AS deleted", "Author AS author")
				.from("data", "Origin")
				.where("Name COLLATE utf8mb4_bin %*like*", emote)
			);

			if (fallbackEmoteData.length === 0) {
				return {
					success: false,
					reply: "No definitions found for given query!"
				};
			}
			else if (fallbackEmoteData.length === 1) {
				// if there is exactly one emote found with the fallback query, continue on with the code in
				// the branch below, basically pretending that emote name was the input.
				emoteData = fallbackEmoteData;
			}
			else {
				const IDs = fallbackEmoteData.map(i => `ID=${i.ID}`).join("&");
				const relayResult = await createRelayLink(`/data/origin/lookup?${IDs}`);

				if (!relayResult.success) {
					return {
						success: false,
						reply: "Could not create a relay link for found definitions! Try again later."
					};
				}
				else {
					return {
						success: true,
						reply: `Found ${fallbackEmoteData.length} definitions for your query, check them out here: ${relayResult.link}`
					};
				}
			}
		}

		// Attempt to use the emote available in current channel (context) first, if no index is provided
		const customIndex = context.params.index ?? null;
		const implicitEmote = emoteData.find(i => i.emoteId === contextEmoteID);
		if (emoteData.length > 1 && customIndex === null && !implicitEmote) {
			const IDs = emoteData.map(i => `ID=${i.ID}`).join("&");
			const relayResult = await createRelayLink(`/data/origin/lookup?${IDs}`);

			if (!relayResult.success) {
				return {
					success: true,
					reply: `Multiple emotes found! Use "index:0" through "index:${IDs.length - 1}" to access each one.`,
					cooldown: { length: 2500 }
				};
			}
			else {
				return {
					success: true,
					reply: `Multiple emotes found! Check the list here: ${relayResult.link}.`,
					cooldown: { length: 2500 }
				};
			}
		}

		const data = (emoteData.length > 1 && customIndex === null)
			? implicitEmote
			: emoteData[customIndex ?? 0];

		if (!data) {
			return {
				success: false,
				reply: "No emote definition exists for this index!"
			};
		}

		let extras = "";
		if (emoteData.length > 1 && customIndex === null) {
			extras = `(${emoteData.length - 1} extras) `;
		}

		let authorString = "";
		if (data.author) {
			const authorUserData = await sb.User.getAsserted(data.author);
			authorString = `Made by @${authorUserData.Name}.`;
		}

		let addedString = "";
		if (data.added) {
			addedString = `Added on ${data.added.format("Y-m-d")}.`;
		}

		let deletedString = "";
		if (data.deleted) {
			deletedString = `Removed on ${data.deleted.format("Y-m-d")}.`;
		}

		const text = data.text.replaceAll(/\[(.+?)]\(\d+\)/g, "$1");
		const link = `https://supinic.com/data/origin/detail/${data.ID}`;

		let type;
		const [provider, providerType = ""] = data.type.split(" - ");
		if (data.type === "Twitch - Bits" && data.tier !== null) {
			const thousandBits = Number(data.tier) / 1000;
			type = `${thousandBits}k bits ${provider}`;
		}
		else if (data.tier) {
			type = `T${data.tier} ${providerType.toLowerCase()} ${provider}`;
		}
		else {
			type = `${providerType.toLowerCase()} ${provider}`;
		}

		return {
			reply: core.Utils.tag.trim `
				${extras}
				${link}					
				${type} emote:
				${text}
				${addedString}
				${deletedString}
				${authorString}
			`
		};
	}),
	Dynamic_Description: null
});
