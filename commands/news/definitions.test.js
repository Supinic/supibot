/* eslint-disable max-nested-callbacks, prefer-arrow-callback */
const assert = require("node:assert");
const definitions = require("./definitions.json").sort((a, b) => a.code.localeCompare(b.code));

const rssFetch = async (url) => await fetch(url, {
	headers: {
		// "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
		// "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/602.1 (KHTML, like Gecko) QuiteRss/0.19.4 Version/10.0 Safari/602.1"
		Accept: "application/xml,text/html,application/xhtml+xml"
	},
	redirect: "follow"
});

describe("valid RSS news definitions", function () {
	if (typeof globalThis.fetch !== "function") {
		return it.skip("Cannot test - fetch is not avilable");
	}

	const RSS = new (require("rss-parser"))({
		defaultRSS: 0.9
	});

	for (const definition of definitions) {
		describe(definition.code.toUpperCase(), function () {
			const { sources } = definition;

			for (const source of sources) {
				describe(source.name, function () {
					assert.strictEqual(source.url.endsWith("/"), false, "Main URL part must not have a trailing slash");
					if (source.path) {
						assert.strictEqual(source.path.endsWith("/"), false, "Secondary URL path must not have a trailing slash");
					}

					const urls = source.endpoints.map(endpoint => (
						[source.url, source.path, endpoint].filter(Boolean).join("/")
					));

					for (const url of urls) {
						it(`${url} should be a valid RSS feed`, async function () {
							this.timeout(5000);

							let rssData;
							await assert.doesNotReject(async () => {
								const response = await rssFetch(url);
								const xml = await response.text();
								rssData = await RSS.parseString(xml);

								assert.notStrictEqual(rssData.items.length, 0, "RSS feed must not be empty");
							}, `URL: ${url}`);
						});
					}
				});
			}
		});
	}
});
