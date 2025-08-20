import type { DoesNotExistSubcommandDefinition } from "../index.js";
const MP_CACHE_KEY = `command-dne-mp-data`;

type ParliamentMember = {
	id: number;
	name: string;
	location: string;
};

export default {
	name: "member-of-parliament",
	aliases: ["mp"],
	title: "Member of Parliament",
	default: false,
	description: [
		`<code>mp</code> - <a href="https://vole.wtf/this-mp-does-not-exist/">This MP does not exist</a>`
	],
	execute: async () => {
		let data = await core.Cache.getByPrefix(MP_CACHE_KEY) as ParliamentMember[] | undefined;
		if (!data) {
			const response = await core.Got.get("FakeAgent")({
				url: "https://vole.wtf/this-mp-does-not-exist",
				responseType: "text"
			});

			const $ = core.Utils.cheerio(response.body);
			const list = $("section ul");

			data = [...list.children()].map(item => {
				const id = Number(item.attribs["data-id"]);
				const name = $(item.children[0]).text().trim();
				const location = $(item.children[2]).text().trim();

				return { id, name, location };
			});

			await core.Cache.setByPrefix(MP_CACHE_KEY, data, {
				expiry: 30 * 864e5 // 30 days
			});
		}

		const member = core.Utils.randArray(data);
		const id = core.Utils.zf(member.id, 5);
		const text = `https://vole.wtf/this-mp-does-not-exist/mp/mp${id}.jpg`;

		return {
			text,
			reply: `This MP does not exist: ${text} - ${member.name} from ${member.location}`
		};
	}
} satisfies DoesNotExistSubcommandDefinition;
