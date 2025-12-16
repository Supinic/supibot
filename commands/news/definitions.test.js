/* eslint-disable max-nested-callbacks, prefer-arrow-callback */
import assert from "node:assert";
import rawDefinitions from "./definitions.json" with { type: "json" };
import RssParser from "rss-parser";

const rssFetch = async (url) => await fetch(url, {
	headers: {
		// "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
		"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/602.1 (KHTML, like Gecko) QuiteRss/0.19.4 Version/10.0 Safari/602.1",
		Accept: "application/xml,text/html,application/xhtml+xml"
	},
	redirect: "follow"
});

describe("valid RSS news definitions", function () {
	if (typeof globalThis.fetch !== "function") {
		return it.skip("Cannot test - fetch is not avilable");
	}

	const definitions = rawDefinitions.sort((a, b) => a.code.localeCompare(b.code));
	const RSS = new RssParser({
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
							this.timeout(7500);

							let dataLength;
							let response;
							let xml;
							let error = null;

							try {
								response = await rssFetch(url);
								xml = await response.text();
								const rssData = await RSS.parseString(xml);

								dataLength = rssData.items.length;
							}
							catch (e) {
								console.error({
									e,
									url,
									// response,
									xml
								});
								error = e;
							}

							assert.strictEqual(error, null, "No error must occur");
							assert.notStrictEqual(dataLength, 0, `RSS feed must not be empty (${url})`);
						});
					}
				});
			}
		});
	}
});
