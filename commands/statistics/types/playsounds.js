module.exports = {
	name: "playsound",
	aliases: ["ps"],
	description: "Checks the amount of times a given playsound has been used.",
	execute: async (context, type, name) => {
		const data = await sb.Query.getRecordset(rs => rs
			.select("Name", "Use_Count")
			.from("data", "Playsound")
		);

		if (name === "all" || name === "total") {
			const total = data.reduce((acc, cur) => (acc += cur.Use_Count), 0);
			return {
				reply: `Playsounds have been used a total of ${total} times.`
			};
		}

		const target = data.find(i => i.Name === name);
		if (target) {
			return {
				reply: `That playsound has been used a total of ${target.Use_Count} times.`
			};
		}
		else {
			return {
				success: false,
				reply: `That playsound does not exist!`
			};
		}
	}
};
