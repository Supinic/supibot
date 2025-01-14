const { randomInt } = require("../../utils/command-utils.js");
const { uploadToImgur, uploadToNuuls } = require("../../utils/command-utils.js");

const MP_CACHE_KEY = `command-dne-mp-data`;

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
		const id = randomInt(10000, 99999);
		const creativity = randomInt(3, 20);
		const psi = (creativity / 10).toFixed(1);

		return `https://thisanimedoesnotexist.ai/results/psi-${psi}/seed${id}.png`;
	},
	fursona: () => {
		const number = randomInt(1, 99999);
		const padded = sb.Utils.zf(number, 5);

		return `https://thisfursonadoesnotexist.com/v2/jpgs-2x/seed${padded}.jpg`;
	},
	sneaker: () => {
		const id = randomInt(1, 2000);
		const params = [
			randomInt(1, 5),
			randomInt(1, 5),
			randomInt(1, 3)
		];

		return `https://thissneakerdoesnotexist.com/wp-content/plugins/sneaker-plugin/imsout2/${params[0]}-${params[1]}-${params[2]}-${id}.jpg`;
	},
	waifu: () => `https://www.thiswaifudoesnotexist.net/example-${randomInt(1, 1e5)}.jpg`,
	wojak: () => `https://archive.org/download/thiswojakdoesnotexist.com/img/${randomInt(1, 1576)}.png`
};

const staticNumberedLinkMapSummary = {
	anime: () => `https://thisanimedoesnotexist.ai/slider.html?seed=${randomInt(10000, 99999)}`,
	sneaker: () => `https://thissneakerdoesnotexist.com/editor/?seed=${randomInt(1, 2000)}`
};

module.exports = {
	methods: [
		{
			method: "reuploading an API request response",
			descriptions: ["person"].map(i => (
				`<code>${i}</code> - <a href="https://this-person-does-not-exist.com/">This ${i} does not exist</a>`
			)),
			types: ["person"],
			execute: async (context, type) => {
				const response = await sb.Got.get("GenericAPI")({
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
				const imageResponse = await sb.Got.get("FakeAgent")({
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
				const imageData = await sb.Got.get("GenericAPI")({
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
			types: ["anime", "fursona", "sneaker", "waifu", "wojak"],
			descriptions: [
				`<code>fursona</code> - <a href="https://thisfursonadoesnotexist.com/">This fursona does not exist</a>`
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
				const response = await sb.Got.get("FakeAgent")({
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
				const response = await sb.Got.get("FakeAgent")({
					url: "https://www.thisautomobiledoesnotexist.com",
					responseType: "text"
				});

				const $ = sb.Utils.cheerio(response.body);
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
				const response = await sb.Got.get("FakeAgent")({
					url: "https://www.thisfuckeduphomerdoesnotexist.com",
					responseType: "text"
				});

				const $ = sb.Utils.cheerio(response.body);
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
				let data = await sb.Cache.getByPrefix(MP_CACHE_KEY);
				if (!data) {
					const response = await sb.Got.get("FakeAgent")({
						url: "https://vole.wtf/this-mp-does-not-exist",
						responseType: "text"
					});

					const $ = sb.Utils.cheerio(response.body);
					const list = $("section ul");

					data = [...list.children()].map(item => {
						const id = Number(item.attribs["data-id"]);
						const name = item.children[0].firstChild.data.trim();
						const location = item.children[2].firstChild.data.trim();

						return { id, name, location };
					});

					await sb.Cache.setByPrefix(MP_CACHE_KEY, data, {
						expiry: 30 * 864e5 // 30 days
					});
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
