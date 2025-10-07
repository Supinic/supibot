export default {
	name: "suggestion",
	aliases: ["suggest", "suggestions"],
	parameter: "ID",
	description: "Marks an active suggestion created by you to be \"Dismissed by author\", therefore removing it from the list of active suggestions.",
	flags: {
		pipe: false // $suggest itself isn't pipe-able
	},
	getLastID: (context) => core.Query.getRecordset(rs => rs
		.select("ID")
		.from("data", "Suggestion")
		.where("User_Alias = %n", context.user.ID)
		.orderBy("ID DESC")
		.limit(1)
		.single()
		.flat("ID")
	),
	unset: async (context, ID, ...args) => {
		const row = await core.Query.getRow("data", "Suggestion");
		try {
			await row.load(ID);
		}
		catch {
			return {
				success: false,
				reply: "ID does not exist!"
			};
		}

		if (row.values.User_Alias !== context.user.ID) {
			return {
				success: false,
				reply: "That suggestion was not created by you!"
			};
		}
		else if (!row.values.Status || row.values.Status === "New" || row.values.Status === "Needs testing") {
			if (!row.values.Status || row.values.Status === "New") {
				row.values.Status = "Dismissed by author";
				row.values.Priority = null;
			}
			else if (row.values.Status === "Needs testing") {
				row.values.Status = "Completed";
				if (args.length > 0) {
					row.values.Notes = `Testing updated by author: ${args.join(" ")}\n\n${row.values.Notes}`;
				}
			}

			if (!row.values.Category) {
				row.values.Category = "Void";
			}

			await row.save({ skipLoad: true });

			return {
				reply: `Suggestion ID ${ID} has been set as "${row.values.Status}".`
			};
		}
		else {
			return {
				success: false,
				reply: "You cannot unset a suggestion if it's already been processed!"
			};
		}
	}
};
