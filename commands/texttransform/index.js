module.exports = {
	Name: "texttransform",
	Aliases: ["tt","reversetexttransform","rtt"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Transforms provided text into one of provided types, such as \"vaporwave\", for example.",
	Flags: ["external-input","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function textTransform (context, name, ...args) {
		if (!name) {
			return {
				success: false,
				reply: "No type provided! Check the command's help for more info."
			};
		}
		else if (args.length === 0) {
			return {
				success: false,
				reply: "No message provided!"
			};
		}

		const transforms = require("./transforms.js");
		const message = args.join(" ");
		const transformation = transforms.types.find(i => (
			i.name === name || (i.aliases && i.aliases.includes(name))
		));

		if (!transformation) {
			return {
				success: false,
				reply: "Invalid type provided!"
			};
		}

		let { type, data } = transformation;

		if (context.invocation === "rtt") {
			if (type === "map") {
				type = "unmap";
			}
			else if (type === "method" && transformation.reverseData) {
				data = transformation.reverseData;
			}
			else {
				return {
					success: false,
					reply: `This transformation type cannot be reversed!`
				};
			}
		}

		const result = transforms.convert[type](message, data, context);
		if (!result) {
			return {
				success: false,
				reply: "No result has been created?!"
			};
		}
		else if (result.success === false) {
			return result;
		}

		return {
			meta: {
				skipWhitespaceCheck: true
			},
			reply: result,
			cooldown: {
				length: (context.append.pipe) ? null : this.Cooldown
			}
		};
	}),
	Dynamic_Description: (async function (prefix) {
		const lorem = "Lorem Ipsum is simply dummy text of the printing and typesetting industry.";
		const { types, convert } = require("./transforms.js");

		const sortedTypes = [...types].sort((a, b) => a.name.localeCompare(b.name));
		const examples = sortedTypes.map(transform => {
			const description = transform.description ?? "(no description)";
			const message = convert[transform.type](lorem, transform.data ?? null);
			const aliases = (transform.aliases.length === 0)
				? ""
				: ` (${transform.aliases.join(", ")})`;

			const reversible = (transform.type === "map" || transform.reverseData) ? "Yes" : "No";
			return sb.Utils.tag.trim `
				<li>
					<code>${transform.name}${aliases}</code>
					<ul>
						<li>Reversible: ${reversible}</li>
						<li>${description}</li>
						<li>${message}</li>
					</ul>
				</li>
			`;
		});

		return [
			"Transforms some given text to different styles, according to the transform type provided.",
			"Each type, and their aliases listed below, along with an example.",
			"",

			`Note: if used within the <a href="/bot/command/detail/pipe">pipe command</a>, this command has no cooldown, and you can use it multiple times within the same pipe!`,
			"",

			`<code>${prefix}tt (type) (text)</code>`,
			`<code>${prefix}texttransform (type) (text)</code>`,
			"Provided text transformed based on the type selected.",

			`Example text: ${lorem}`,
			"",

			`<ul>${examples.join("<br>")}</ul>`
		];
	})
};
