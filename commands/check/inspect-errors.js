const { postToHastebin } = require("../../utils/command-utils.js");

const getRow = {
	error: () => sb.Query.getRow("chat_data", "Error"),
	webError: () => sb.Query.getRow("supinic.com", "Error")
};
const name = {
	error: "Supibot error",
	webError: "Website error"
};

export default async function inspectErrorStacks (command, context, type, rawIdentifier) {
	const inspectErrorStacks = await context.user.getDataProperty("inspectErrorStacks");
	if (!inspectErrorStacks) {
		return {
			success: false,
			reply: "Sorry, you can't inspect error stacks! If you think you should have access, make a suggestion."
		};
	}

	const identifier = Number(rawIdentifier);
	if (!sb.Utils.isValidInteger(identifier)) {
		return {
			success: false,
			reply: "Invalid ID provided!"
		};
	}

	const row = await getRow[type]();
	await row.load(identifier, true);

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
		const paste = await postToHastebin(stack, {
			name: `Stack of ${name[type]} ID ${ID}`,
			expiration: "1H"
		});

		if (!paste.ok) {
			return {
				success: false,
				reply: paste.reason
			};
		}

		link = paste.link;
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
