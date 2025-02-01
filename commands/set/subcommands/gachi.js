export default {
	name: "gc",
	aliases: ["gachi"],
	parameter: "ID",
	description: "If you made a mistake with the gc command, you can use this to remove a track from the todo list.",
	flags: {
		pipe: true
	},
	unset: async (context, ID) => {
		const row = await sb.Query.getRow("music", "Track");
		try {
			await row.load(ID);
		}
		catch {
			return {
				success: false,
				reply: "ID does not exist!"
			};
		}

		const permissions = await context.getUserPermissions();
		const isAdmin = permissions.is("administrator");
		const isAuthor = (row.values.Added_By === context.user.ID);
		const isHelper = Boolean(await context.user.getDataProperty("trackListHelper"));

		if (!isAdmin && !isHelper && !isAuthor) {
			return {
				success: false,
				reply: "This track was not added by you!"
			};
		}

		const tags = await sb.Query.getRecordset(rs => rs
			.select("Tag")
			.from("music", "Track_Tag")
			.where("Track = %n", ID)
			.flat("Tag")
		);

		// If the gachi tag is present already, there is no reason to unset it.
		if (tags.includes(6)) {
			return {
				success: false,
				reply: "This track has already been categorized, and cannot be changed like this!"
			};
		}

		// Deletes the "to-do" tag of given track.
		await sb.Query.raw(`DELETE FROM music.Track_Tag WHERE (Track = ${ID} AND Tag = 20)`);

		return {
			reply: `Track ID ${ID} (${row.values.Name}) has been stripped of the TODO tag.`
		};
	}
};
