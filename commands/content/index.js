module.exports = {
	Name: "content",
	Aliases: null,
	Author: "supinic",
	Cooldown: 30000,
	Description: "Shows how many suggestions there are Uncategorized and New - basically showing how much content I have for the next stream.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function content () {
		const data = await sb.Query.getRecordset(rs => rs
			.select("ID", "Category", "Status")
			.from("data", "Suggestion")
		);
	
		const count = {
			new: data.filter(i => i.Category === "Uncategorized" && i.Status === "New").length,
			approved: data.filter(i => i.Status === "Approved").length
		};	
	
		return {
			reply: `Content status: ${count.new} new suggestions, ${count.approved} are approved and waiting!`
		};
	}),
	Dynamic_Description: null
};