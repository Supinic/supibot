const getRow = {
	error: () => sb.Query.getRow("chat_data", "Error"),
	webError: () => sb.Query.getRow("supinic.com", "Error")
};
const name = {
	error: "Supibot error",
	webError: "Website error"
};

module.exports = async function inspectErrorStacks (command, context, type, identifier) {
	const inspectErrorStacks = await context.user.getDataProperty("inspectErrorStacks");
	if (!inspectErrorStacks) {
		return {
			success: false,
			reply: "Sorry, you can't inspect error stacks! If you think you should have access, make a suggestion."
		};
	}

	if (!Number(identifier)) {
		return {
			success: false,
			reply: "Invalid ID provided!"
		};
	}

	const row = await getRow[type]();
	await row.load(Number(identifier), true);

	if (!row.loaded) {
		return {
			success: false,
			reply: "No such error exists!"
		};
	}

	const { ID, Stack: stack } = row.values;

	const key = { type: `${type}-paste`, ID };
	let link = await command.getCacheData(key);
	if (!link) {
		const result = await sb.Pastebin.post(stack, {
			name: `Stack of ${name[type]} ID ${ID}`,
			expiration: "1H"
		});

		if (result.success !== true) {
			return {
				success: false,
				reply: result.error ?? result.body
			};
		}

		link = result.body;
		await command.setCacheData(key, link, {
			expiry: 36e5
		});
	}

	const reply = `Detail of ${name[type]} ID ${ID}: ${link}`;
	if (context.privateMessage) {
		return { reply };
	}

	await context.platform.pm(reply, context.user.Name, context.channel ?? null);
	return {
		reply: "I private messaged you with the link to the error stack Pastebin 💻"
	};
};
