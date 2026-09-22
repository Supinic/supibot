import { SupiDate } from "supi-core";
import cacheKeys from "../../utils/shared-cache-keys.json" with { type: "json" };
import { defineChatModule } from "../../classes/chat-module.js";
import { twitchVodSchema } from "../../utils/schemas.js";
const { SONG_REQUESTS_STATE } = cacheKeys;

type StreamRow = {
	Video_ID: string;
	Date: SupiDate;
	Start: SupiDate;
	End: SupiDate;
};

const handle = async (event: "online" | "offline") => {
	const response = await core.Got.get("Helix")({
		url: "videos",
		searchParams: {
			user_id: "31400525", // possibly move to config and rename the entire module
			first: "1"
		}
	});

	if (!response.ok) {
		console.warn("Stream database event failed", { response });
		return;
	}

	const stream = twitchVodSchema.parse(response.body).data.at(0);
	if (stream) {
		const start = new SupiDate(stream.created_at);
		const date = start.clone().discardTimeUnits("h", "m", "s", "ms");
		const exists = await core.Query.getRecordset<string | undefined>(rs => rs
			.select("Video_ID")
			.from("stream", "Stream")
			.where("Video_ID = %s", stream.id)
			.single()
			.flat("Video_ID")
		);

		console.log("stream-db", { stream, exists });

		// Stream just went online + no row exists => create a new Stream row
		if (!exists && event === "online") {
			const row = await core.Query.getRow<StreamRow>("stream", "Stream");
			row.setValues({
				Video_ID: stream.id,
				Date: date,
				Start: start
			});

			await row.save();
		}
		// Stream just went offline + row already exists => mark the Stream as completed by setting its End property
		else if (exists && event === "offline") {
			const row = await core.Query.getRow<StreamRow>("stream", "Stream");
			await row.load(stream.id);

			if (stream.duration) {
				const vodDuration = core.Utils.parseVideoDuration(stream.duration);
				if (vodDuration) {
					row.values.End = start.clone().addSeconds(vodDuration);
				}
			}

			await row.save();
		}
	}
	else if (event === "offline") {
		void core.Cache.setByPrefix(SONG_REQUESTS_STATE, "off");
		void sb.MpvClient?.ping();

		// No stream data - stream is already offline
		// Try and find an unfinished stream - look up by date and look for unfinished ones (End IS NULL)
		const yesterday = new SupiDate().discardTimeUnits("h", "m", "s", "ms").addDays(-1);
		const activeVideoID = await core.Query.getRecordset<string | undefined>(rs => rs
			.select("Video_ID")
			.from("stream", "Stream")
			.where("Date >= %d", yesterday)
			.where("Start IS NOT NULL")
			.where("End IS NULL")
			.single()
			.flat("Video_ID")
		);

		if (activeVideoID) {
			const row = await core.Query.getRow<StreamRow>("stream", "Stream");
			await row.load(activeVideoID);

			row.values.End = new SupiDate().discardTimeUnits("s", "ms");
			await row.save();
		}
	}
};

export default defineChatModule({
	name: "supinic-stream-db",
	description: "Creates and updates database rows of Streams on Supinic's channel as he goes on/offline.",
	scope: "channel",
	platform: ["twitch"],
	handlers: {
		online () {
			void handle("online");
		},

		offline () {
			void handle("offline");
		}
	}
});
