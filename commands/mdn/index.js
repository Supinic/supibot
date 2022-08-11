module.exports = {
	Name: "mdn",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Searches the MDN website for a given term, then returns the article link.",
	Flags: ["developer","mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function mdn (context, ...args) {
		const query = args.join(" ");
		if (!query) {
			return {
				reply: "No input provided!"
			};
		}

		const response = await sb.Got("GenericAPI", {
			url: "https://developer.mozilla.org/api/v1/search",
			searchParams: {
				q: query,
				locale: "en-US"
			}
		});

		if (response.body.documents.length === 0) {
			return {
				reply: "No articles found!"
			};
		}

		const { title, slug } = response.body.documents[0];
		return {
			reply: `${title}: https://developer.mozilla.org/en-US/docs/${slug}`
		};
	}),
	Dynamic_Description: (async (prefix) => {
		const url = "https://developer.mozilla.org/es/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing_operator";

		return [
			`<code>${prefix}mdn Nullish coalescing</code>`,
			`Nullish coalescing operator <a target="_blank" href="${url}">${url}</a>`
		];
	})
};
