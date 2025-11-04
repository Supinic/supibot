import { declare } from "../../classes/command.js";
import { type NewAfkData } from "../../classes/afk.js";
import { SupiDate } from "supi-core";

const RESUME_AFK_THRESHOLD_SEC = 120;

type AfkData = NewAfkData & {
	Ended: SupiDate | null;
};

export default declare({
	Name: "resumeafk",
	Aliases: ["rafk", "cafk", "continueafk"],
	Cooldown: 60_000,
	Description: "Resumes your AFK status, if used shortly after coming back from an AFK. The time period is global, not just in the channel you came back from AFK in.",
	Flags: ["mention", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: (async function resumeAFK (context) {
		if (context.privateMessage) {
			return {
				success: false,
				reply: "Resuming your AFK status is only permitted outside of private messages!"
			};
		}

		const lastAFK = await core.Query.getRecordset<AfkData | undefined>(rs => rs
			.select("*")
			.from("chat_data", "AFK")
			.where("User_Alias = %n", context.user.ID)
			.orderBy("ID DESC")
			.limit(1)
			.single()
		);

		if (!lastAFK) {
			return {
				success: false,
				reply: "You cannot resume your AFK status, because you have never went AFK with me before!"
			};
		}
		else if (!lastAFK.Ended) {
			return {
				reply: "You were AFK until this moment... Try again?",
				cooldown: 10_000
			};
		}

		const now = new SupiDate().valueOf();
		const threshold = lastAFK.Ended.addSeconds(RESUME_AFK_THRESHOLD_SEC).valueOf();
		if (threshold <= now) {
			return {
				reply: "You cannot resume your AFK status, because it ended too long ago!",
				cooldown: 10_000
			};
		}
		else if (lastAFK.Interrupted_ID) {
			return {
				success: false,
				reply: "You have somehow already resumed this AFK status!",
				cooldown: 10_000
			};
		}

		const newAFK = await sb.AwayFromKeyboard.set(context.user, {
			User_Alias: context.user.ID,
			Text: lastAFK.Text,
			Started: lastAFK.Started,
			Status: lastAFK.Status
		});

		const oldAFK = await core.Query.getRow("chat_data", "AFK");
		await oldAFK.load(lastAFK.ID);

		oldAFK.setValues({
			Interrupted_ID: newAFK.ID,
			Active: false
		});

		await oldAFK.save({ skipLoad: true });

		return {
			reply: "Your AFK status has been resumed.",
			cooldown: { // Turns the cooldown into a global one (all channels)
				user: context.user.ID,
				command: this.Name,
				channel: null,
				length: this.Cooldown
			}
		};
	}),
	Dynamic_Description: null
});
