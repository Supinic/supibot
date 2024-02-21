const { uploadToImgur, uploadToNuuls } = require("../../utils/command-utils.js");

module.exports = {
	Name: "doesnotexist",
	Aliases: ["dne"],
	Author: "supinic",
	Cooldown: 15000,
	Description: "Posts a random picture from the site thispersondoesnotexist.com, and its variants (check extended help for a list). These pictures are not real, they have been generated by an AI.",
	Flags: ["non-nullable","pipe"],
	Params: [
		{ name: "linkOnly", type: "boolean" },
		{ name: "summary", type: "boolean" },
		{ name: "wordOnly", type: "boolean" }
	],
	Whitelist_Response: null,
	Static_Data: (command => {
		const buildURL = (type) => {
			if (type === "person") {
				return `https://this${type}doesnotexist.com/image`;
			}
			else {
				return `https://this${type}doesnotexist.com`;
			}
		};

		const staticNumberedLinkMap = {
			anime: () => {
				const id = sb.Utils.random(10000, 99999);
				const creativity = sb.Utils.random(3, 20);
				const psi = (creativity / 10).toFixed(1);

				return `https://thisanimedoesnotexist.ai/results/psi-${psi}/seed${id}.png`;
			},
			fursona: () => {
				const number = sb.Utils.random(1, 99999);
				const padded = sb.Utils.zf(number, 5);

				return `https://thisfursonadoesnotexist.com/v2/jpgs-2x/seed${padded}.jpg`;
			},
			sneaker: () => {
				const id = sb.Utils.random(1, 2000);
				const params = [
					sb.Utils.random(1, 5),
					sb.Utils.random(1, 5),
					sb.Utils.random(1, 3)
				];

				return `https://thissneakerdoesnotexist.com/wp-content/plugins/sneaker-plugin/imsout2/${params[0]}-${params[1]}-${params[2]}-${id}.jpg`;
			},
			vessel: () => {
				const number = sb.Utils.random(1, 2e4);
				const padded = sb.Utils.zf(number, 7);

				return `https://thisvesseldoesnotexist.s3-us-west-2.amazonaws.com/public/v2/fakes/${padded}.jpg`;
			},
			waifu: () => `https://www.thiswaifudoesnotexist.net/example-${sb.Utils.random(1, 1e5)}.jpg`,
			wojak: () => `https://archive.org/download/thiswojakdoesnotexist.com/img/${sb.Utils.random(1, 1576)}.png`
		};

		const staticNumberedLinkMapSummary = {
			anime: () => `https://thisanimedoesnotexist.ai/slider.html?seed=${sb.Utils.random(10000, 99999)}`,
			sneaker: () => `https://thissneakerdoesnotexist.com/editor/?seed=${sb.Utils.random(1, 2000)}`
		};

		return {
			fetch: [
				{
					method: "reuploading an API request response",
					descriptions: ["person"].map(i => (
						`<code>${i}</code> - <a href="https://this-person-does-not-exist.com/">This ${i} does not exist</a>`
					)),
					types: ["person"],
					execute: async (context, type) => {
						const response = await sb.Got("GenericAPI", {
							url: "https://this-person-does-not-exist.com/new",
							searchParams: {
								new: sb.Date.now(),
								gender: "all", // male, female
								age: "all", // 12-18, 19-25, 26-35, 35-50, 50+
								etnic: "all" // asian, black, white, indian, middle eastern, latino hispanic
							}
						});

						if (!response.ok) {
							return {
								success: false,
								reply: `Could not generate a random picture!`
							};
						}

						const { src } = response.body;
						const imageResponse = await sb.Got("FakeAgent", {
							url: `https://this-person-does-not-exist.com${src}`,
							responseType: "buffer"
						});

						if (!imageResponse.ok) {
							return {
								success: false,
								reply: `Could not fetch a random picture!`
							};
						}

						const { statusCode, link } = await uploadToImgur(imageResponse.rawBody ?? imageResponse.body);
						if (statusCode !== 200) {
							return {
								success: false,
								reply: `Could not upload the image to Imgur! Errors: ${statusCode}`
							};
						}

						return {
							link,
							reply: `This ${type} does not exist: ${link}`
						};
					}
				},
				{
					// "cat" commented out due to SSL error on http://thiscatdoesnotexist.com/ - domain likely got jacked
					method: "reuploading a provided random image",
					descriptions: ["artwork"/* , "cat" */].map(i => (
						`<code>${i}</code> - <a href="${buildURL(i)}">This ${i} does not exist</a>`
					)),
					types: ["artwork"/* , "cat"*/],
					execute: async (context, type) => {
						const imageData = await sb.Got("GenericAPI", {
							url: buildURL(type),
							responseType: "buffer",
							throwHttpErrors: false
						});

						if (imageData.statusCode !== 200) {
							console.warn("dne download failed", imageData);
							return {
								success: false,
								reply: `Fetching image data failed monkaS`
							};
						}

						let { statusCode, link } = await uploadToNuuls(imageData.rawBody ?? imageData.body);
						if (statusCode !== 200) {
							const result = await uploadToImgur(imageData.rawBody ?? imageData.body);
							if (result.statusCode !== 200) {
								return {
									success: false,
									reply: `Could not upload the image to either Nuuls or Imgur! Errors: ${statusCode}, ${result.statusCode}`
								};
							}

							link = result.link;
						}

						return {
							link,
							reply: `This ${type} does not exist: ${link}`
						};
					}
				},
				{
					method: "rolls a random number for a static link",
					types: ["anime", "fursona", "sneaker", "vessel", "waifu", "wojak"],
					descriptions: [
						`<code>fursona</code> - <a href="https://thisfursonadoesnotexist.com/">This fursona does not exist</a>`,
						`<code>vessel</code> - <a href="https://thisvesseldoesnotexist.com/#/fakes/">This vessel does not exist</a>`
					],
					execute: async (context, type) => {
						const link = staticNumberedLinkMap[type]();
						return {
							link,
							reply: `This ${type} does not exist: ${link}`
						};
					}
				},
				{
					method: "rolls a random number for a static link - posting a summary rather than a single link",
					parameter: "summary",
					types: ["anime", "sneaker"],
					descriptions: [
						`<code>waifu</code> - <a href="https://www.thiswaifudoesnotexist.net/">This waifu does not exist</a> - supports <code>summary</code> parameter`,
						`<code>wojak</code> - <a href="https://thiswojakdoesnotexist.com//">This wojak does not exist</a> - supports <code>summary</code> parameter`
					],
					execute: async (context, type) => {
						const link = staticNumberedLinkMapSummary[type]();
						return {
							link,
							reply: `This ${type} summary does not exist: ${link}`
						};
					}
				},
				{
					method: "scraping for random word",
					types: ["word"],
					descriptions: [`<code>word</code> - <a href="https://www.thisworddoesnotexist.com/">This word does not exist</a>`],
					execute: async (context, type) => {
						const response = await sb.Got("FakeAgent", {
							url: "https://www.thisworddoesnotexist.com/",
							responseType: "text",
							throwHttpErrors: false
						});

						if (response.statusCode !== 200) {
							return {
								success: false,
								reply: `Could not fetch a random word definition - website error!`
							};
						}

						const $ = sb.Utils.cheerio(response.body);
						const wordClass = $("div#definition-pos")
							.text()
							.replace(/\./g, "")
							.trim();

						const word = $("div#definition-word").text();
						const definition = $("div#definition-definition").text().trim();
						const example = $("div#definition-example").text();

						if (context.params.wordOnly) {
							return {
								link: "No link available for this type!",
								reply: word
							};
						}

						return {
							link: "No link available for this type!",
							reply: sb.Utils.tag.trim `
								This ${type} does not exist:
								${word} (${wordClass}) -
								${definition}.
								Example: ${example ?? "N/A"}
							`
						};
					}
				},
				{
					method: "scraping for a base64 encoded image, turning it into a buffer, then upload to nuuls/imgur",
					types: "automobile",
					descriptions: [`<code>automobile</code> - <a href="https://www.thisautomobiledoesnotexist.com/">This automobile does not exist</a>`],
					execute: async (context, type) => {
						const imageResponse = await sb.Got("https://www.thisautomobiledoesnotexist.com/");
						const $ = sb.Utils.cheerio(imageResponse.body);
						const imageSource = $("#vehicle").attr("src").replace("data:image/png;base64,", "");
						const imageBuffer = Buffer.from(imageSource, "base64");

						let result = await uploadToNuuls(imageBuffer);
						if (result.statusCode !== 200) {
							result = await uploadToImgur(imageBuffer);
							if (result.statusCode !== 200) {
								return {
									success: false,
									reply: `Couldn't upload the picture to either Nuuls or Imgur!`
								};
							}
						}

						return {
							reply: `This ${type} does not exist: ${result.link}`
						};
					}
				},
				{
					method: "scraping for an image link",
					types: "fuckeduphomer",
					descriptions: [`<code>fuckeduphomer</code> - <a href="https://www.thisfuckeduphomerdoesnotexist.com/">This fucked up Homer does not exist</a>`],
					execute: async () => {
						const html = await sb.Got("https://www.thisfuckeduphomerdoesnotexist.com/").text();
						const $ = sb.Utils.cheerio(html);
						const image = $("#image-payload").attr("src");

						return {
							reply: `This fucked up Homer does not exist: ${image}`
						};
					}
				},
				{
					method: "scraping for a list of image links + text, and caching",
					types: "mp",
					descriptions: [`<code>mp</code> - <a href="https://vole.wtf/this-mp-does-not-exist/">This MP does not exist</a>`],
					execute: async () => {
						let data = await command.getCacheData("mp-data");
						if (!data) {
							const html = await sb.Got("https://vole.wtf/this-mp-does-not-exist/").text();
							const $ = sb.Utils.cheerio(html);
							const list = $("section ul");

							data = [...list.children()].map(item => {
								const id = Number(item.attribs["data-id"]);
								const name = item.children[0].firstChild.data.trim();
								const location = item.children[2].firstChild.data.trim();

								return { id, name, location };
							});

							await command.setCacheData("mp-data", data, { expiry: 30 * 864e5 }); // 30 days
						}

						const member = sb.Utils.randArray(data);
						const id = sb.Utils.zf(member.id, 5);
						const link = `https://vole.wtf/this-mp-does-not-exist/mp/mp${id}.jpg`;

						return {
							reply: `This MP does not exist: ${link} - ${member.name} from ${member.location}`
						};
					}
				}
			]
		};
	}),
	Code: (async function doesnotexist (context, type) {
		const { fetch } = this.staticData;
		if (!type) {
			type = "person";
		}

		type = type.toLowerCase();

		const types = [...new Set(fetch.flatMap(i => i.types))].sort();
		if (type === "list") {
			return {
				reply: `Available types: ${types.join(", ")}`
			};
		}
		else if (!types.includes(type)) {
			return {
				success: false,
				reply: `Invalid type provided! Use one of: ${types.join(", ")}`
			};
		}

		let execute;
		if (context.params.summary === true) {
			const definition = fetch.find(i => i.types.includes(type) && i.parameter === "summary");
			if (!definition) {
				return {
					success: false,
					reply: `That type does not support the "summary" parameter!`
				};
			}

			execute = definition.execute;
		}
		else {
			execute = fetch.find(i => i.types.includes(type)).execute;
		}

		const result = await execute(context, type);

		if (context.params.linkOnly && result.link) {
			return {
				success: result.success ?? true,
				reply: result.link
			};
		}
		else {
			return result;
		}
	}),
	Dynamic_Description: (async function (prefix) {
		const { fetch } = this.staticData;
		const list = fetch
			.flatMap(i => i.descriptions)
			.sort()
			.map(i => `<li>${i}</li>`)
			.join("");

		return [
			`Posts a random picture from the set of "this X does not exist" websites.`,
			"",

			`<code>${prefix}dne list</code>`,
			"Posts a list of available types of stuff that does not exist",
			"",

			`<code>${prefix}dne</code>`,
			"Posts a random person that does not exist",
			"",

			`<code>${prefix}dne (type)</code>`,
			"Posts a random (type) that does not exist",
			"",

			`<code>${prefix}dne word wordOnly:true</code>`,
			"Posts a random word, without the word class, definition or examples",
			"",

			`<code>${prefix}dne anime summary:true</code>`,
			`<code>${prefix}dne sneaker summary:true</code>`,
			"Posts a random type, but instead of a picture a summary of multiple pictures or a slider menu is shown.",
			"",

			"Available types:",
			`<ul>${list}</ul>`
		];
	})
};
