module.exports = (function () {
	"use strict";

	const TemplateClass = require(__dirname + "/template.js");
	const parserList = ["youtube", "vimeo", "nicovideo", "bilibili", "soundcloud", "vk"];

	const parserConstructors = {};
	for (const file of parserList) {
		parserConstructors[file] = require(__dirname + "/" + file + ".js")(TemplateClass);
	}

	return class TrackLinkParser {
		#options = {};
		#parsers = {};

		constructor (options = {}) {
			for (const [target, params] of Object.entries(options)) {
				if (!parserList.includes(target.toLowerCase())) {
					throw new Error("Link parser: unrecognized options for key " + target);
				}
				this.#options[target] = params;
			}

			for (const parser of parserList) {
				this.#parsers[parser] = new parserConstructors[parser](this.#options[parser] || {});
			}
		}

		autoRecognize (link) {
			if (typeof link !== "string") {
				throw new TypeError("Link parser: link must be a string");
			}
			else if (link.length === 0) {
				throw new Error("Link parser: link must be a non-empty string");
			}

			for (const [type, parser] of Object.entries(this.#parsers)) {
				if (parser.parseLink(link)) {
					return type;
				}
			}

			return null;
		}

		parseLink (link, type = "any") {
			if (typeof link !== "string" || typeof type !== "string") {
				throw new TypeError("Link parser: Both link and type must be string");
			}
			else if (type !== "any" && !this.#parsers[type]) {
				throw new Error("Link parser: No parser exists for type " + type);
			}

			if (type === "any") {
				for (const parser of Object.values(this.#parsers)) {
					const parsedLink = parser.parseLink(link);
					if (parsedLink) {
						return parsedLink;
					}
				}

				throw new Error("Link parser: Cannot parse link " + link + " - unable to parse");
			}
			else {
				return this.#parsers[type].parseLink(link);
			}
		}

		checkValid (link, type) {
			if (typeof link !== "string" || typeof type !== "string") {
				throw new TypeError("Link parser: Both link and type must be string");
			}
			else if (!this.#parsers[type]) {
				throw new Error("Link parser: No parser exists for type " + type);
			}

			return this.#parsers[type].checkLink(link);
		}

		async checkAvailable (link, type = "auto") {
			if (typeof link !== "string" || typeof type !== "string") {
				throw new TypeError("Link parser: Both link and type must be string");
			}
			else if (type !== "auto" && !this.#parsers[type]) {
				throw new Error("Link parser: No parser exists for type " + type);
			}

			if (type === "auto") {
				for (const parser of Object.values(this.#parsers)) {
					const parsedLink = parser.parseLink(link);
					if (parsedLink) {
						return await parser.checkAvailable(parsedLink);
					}
				}

				throw new Error("Link parser: Cannot check availability of link " + link + " - unable to parse");
			}
			else {
				const parsedLink = this.#parsers[type].parseLink(link);
				if (parsedLink) {
					return await this.#parsers[type].checkAvailable(parsedLink);
				}
				else {
					throw new Error("Link parser: Cannot check availability of link " + link + " - unable to parse for type " + type);
				}
			}
		}

		async fetchData (link, type = "auto") {
			if (typeof link !== "string" || typeof type !== "string") {
				throw new TypeError("Link parser: Both link and type must be string");
			}
			else if (type !== "auto" && !this.#parsers[type]) {
				throw new Error("Link parser: No parser exists for type " + type);
			}

			if (type === "auto") {
				for (const parser of Object.values(this.#parsers)) {
					const parsedLink = parser.parseLink(link);
					if (parsedLink) {
						return await parser.fetchData(parsedLink);
					}
				}

				throw new Error("Link parser: Cannot fetch data for link " + link + " - unable to parse");
			}
			else {
				return await this.#parsers[type].fetchData(link);
			}
		}

		getParser (parser) {
			return this.#parsers[parser];
		}
	};
})();