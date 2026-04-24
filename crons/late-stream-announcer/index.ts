import type { CronDefinition } from "../index.js";
import { twitchVodSchema } from "../../utils/schemas.js";
import { SupiDate } from "supi-core";

export default {
	name: "late-stream-announcer",
	expression: "30 3,33 * * * *",
	description: "Checks if Supi is streaming when he should, and if not, posts a Weirdga TeaTime",
	code: (async function announceLateStream () {
		const scheduleCommand = sb.Command.get("schedule");
		if (!scheduleCommand) {
			this.stop();
			return;
		}

		const platform = sb.Platform.get("twitch");
		if (!platform) {
			this.stop();
			return;
		}

		const channel = sb.Channel.get("supinic", platform);
		if (!channel || !channel.Specific_ID) {
			this.stop();
			return;
		}

		const vodResponse = await core.Got.get("Helix")({
			url: "videos",
			searchParams: {
				user_id: channel.Specific_ID
			}
		});

		const { data } = twitchVodSchema.parse(vodResponse.body);
		const [latestVod] = data.sort((a, b) => new SupiDate(b.created_at).valueOf() - new SupiDate(a.created_at).valueOf());

		const today = new SupiDate().format("Y-m-d");
		const latestVodStartDate = new SupiDate(latestVod.created_at).format("Y-m-d");
		if (today === latestVodStartDate) { // Stream already happened today
			return;
		}

		const botUser = await sb.User.getAsserted(platform.selfName);
		const fakeContext = sb.Command.createFakeContext(scheduleCommand, {
			platform,
			user: botUser,
			platformSpecificData: null
		});

		const result = await scheduleCommand.execute(fakeContext, "supinic");
		if (result.reply?.includes("seems to be late")) {
			await channel.send("Weirdga TeaTime @Supinic seems to be late");
		}
	})
} satisfies CronDefinition;
