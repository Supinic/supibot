import { SupiDate } from "supi-core";
import cacheKeys from "../../utils/shared-cache-keys.json" with { type: "json" };
const { SONG_REQUESTS_STATE } = cacheKeys;

export default {
	Name: "supinic-stream-db",
	Events: ["online", "offline"],
	Description: "Creates and updates database rows of Streams on Supinic's channel as he goes on/offline.",
	Code: (async function supinicStreamDB (context) {
		const response = await core.Got.get("Helix")({
			url: "videos",
			searchParams: {
				user_id: "31400525",
				first: "1"
			}
		});

		if (!response.ok || !response.body?.data) {
			console.warn("Stream database event failed", { response });
			return;
		}

		const [stream] = response.body.data;
		if (stream) {
			const start = new SupiDate(stream.created_at);
			const date = start.clone().discardTimeUnits("h", "m", "s", "ms");
			const exists = await core.Query.getRecordset(rs => rs
				.select("Video_ID")
				.from("stream", "Stream")
				.where("Video_ID = %s", stream.id)
				.single()
				.flat("Video_ID")
			);

			console.log("stream-db", { stream, exists });

			// Stream just went online + no row exists => create a new Stream row
			if (!exists && context.event === "online") {
				const row = await core.Query.getRow("stream", "Stream");
				row.setValues({
					Video_ID: stream.id,
					Date: date,
					Start: start
				});

				await row.save();
			}
			// Stream just went offline + row already exists => mark the Stream as completed by setting its End property
			else if (exists && context.event === "offline") {
				const row = await core.Query.getRow("stream", "Stream");
				await row.load(stream.id);

				if (stream.duration) {
					const vodDuration = core.Utils.parseVideoDuration(stream.duration);
					row.values.End = start.clone().addSeconds(vodDuration);
				}

				await row.save();
			}
		}
		else if (context.event === "offline") {
			void core.Cache.setByPrefix(SONG_REQUESTS_STATE, "off");
			void sb.MpvClient?.ping();

			// No stream data - stream is already offline
			// Try and find an unfinished stream - look up by date and look for unfinished ones (End IS NULL)
			const yesterday = new SupiDate().discardTimeUnits("h", "m", "s", "ms").addDays(-1);
			const activeVideoID = await core.Query.getRecordset(rs => rs
				.select("Video_ID")
				.from("stream", "Stream")
				.where("Date >= %d", yesterday)
				.where("Start IS NOT NULL")
				.where("End IS NULL")
				.single()
				.flat("Video_ID")
			);

			if (activeVideoID) {
				const row = await core.Query.getRow("stream", "Stream");
				await row.load(activeVideoID);

				row.values.End = new SupiDate().discardTimeUnits("s", "ms");
				await row.save();
			}

			// Clear all pending song requests, set song request status to "off"
			await core.Query.getRecordUpdater(ru => ru
				.update("chat_data", "Song_Request")
				.set("Status", "Inactive")
				.where("Status <> %s", "Inactive")
			);
		}
	}),
	Global: false,
	Platform: null
};
