module.exports = {
	Name: "supinic-stream-db",
	Events: ["online", "offline"],
	Description: "Creates and updates database rows of Streams on Supinic's channel as he goes on/offline.",
	Code: (async function supinicStreamDB (context) {
		const { data: [stream] } = await sb.Got("Helix", {
			url: "videos",
			searchParams:  new sb.URLParams()
				.set("user_id", "31400525")
				.set("first", "1")
				.toString()
		}).json();

		if (stream) {
			const start = new sb.Date(stream.created_at);
			const date = start.clone().discardTimeUnits("h", "m", "s", "ms");
			const exists = await sb.Query.getRecordset(rs => rs
			    .select("Video_ID")
			    .from("stream", "Stream")
				.where("Video_ID = %s", stream.id)
				.single()
				.flat("Video_ID")
			);

			console.log("stream-db", { stream, exists });

			// Stream just went online + no row exists => create a new Stream row
			if (!exists && context.event === "online") {
				const row = await sb.Query.getRow("stream", "Stream");
				row.setValues({
					Video_ID: stream.id,
					Date: date,
					Start: start
				});

				await row.save();
			}
			// Stream just went offline + row already exists => mark the Stream as completed by setting its End property
			else if (exists && context.event === "offline") {
				const row = await sb.Query.getRow("stream", "Stream");
				await row.load(stream.id);

				let mult = 1;
				if (stream.duration) {
					const vodDuration = stream.duration.split(/\D/)
						.filter(Boolean)
						.map(Number)
						.reverse()
						.reduce((acc, cur) => {
							acc += cur * mult;
							mult *= 60;
							return acc;
						}, 0);

					row.values.End = start.clone().addSeconds(vodDuration);
				}

				await row.save();
			}
		}
		else if (context.event === "offline") {
			// No stream data - stream is already offline
			// Try and find an unfinished stream - look up by date and look for unfinished ones (End IS NULL)
			const yesterday = new sb.Date().discardTimeUnits("h", "m", "s", "ms").addDays(-1);
			const activeVideoID = await sb.Query.getRecordset(rs => rs
				.select("Video_ID")
				.from("stream", "Stream")
				.where("Date >= %d", yesterday)
				.where("Start IS NOT NULL")
				.where("End IS NULL")
				.single()
				.flat("Video_ID")
			);

			if (activeVideoID) {
				const row = await sb.Query.getRow("stream", "Stream");
				await row.load(activeVideoID)

				row.values.End = new sb.Date().discardTimeUnits("s", "ms");
				await row.save();
			}
		}
	}),
	Author: "supinic"
};