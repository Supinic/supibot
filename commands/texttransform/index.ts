import transforms from "./transforms.js";
import { declare } from "../../classes/command.js";
import { SupiError } from "supi-core";
const sortedDefinitions = transforms.definitions.toSorted((a, b) => a.name.localeCompare(b.name));

const LOREM_IPSUM = "Lorem Ipsum is simply dummy text of the printing and typesetting industry.";

export default declare({
	Name: "texttransform",
	Aliases: ["tt","reversetexttransform","rtt"],
	Author: "supinic",
	Cooldown: 5000,
	Description: "Transforms provided text into one of the provided types, such as \"vaporwave\", for example.",
	Flags: ["external-input","non-nullable","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: function textTransform (context, name, ...args) {
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

		const message = args.join(" ");
		const transformation = transforms.definitions.find(i => i.name === name || i.aliases.includes(name));
		if (!transformation) {
			return {
				success: false,
				reply: "Invalid type provided!"
			};
		}

		const { data, reverseData } = transformation;
		let method = data;
		if (context.invocation === "rtt") {
			if (typeof reverseData === "function") {
				method = reverseData;
			}
			else {
				return {
					success: false,
					reply: `This transformation type cannot be reversed!`
				};
			}
		}

		const result = method(message);
		if (!result) {
			return {
				success: false,
				reply: "No result has been created?!"
			};
		}
		else if (typeof result === "object") {
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
	},
	Dynamic_Description: (prefix) => {
		const examples = sortedDefinitions.map(definition => {
			const transformedMessage = definition.data(LOREM_IPSUM);
			if (typeof transformedMessage !== "string") {
				throw new SupiError({
					message: `Assert error: Text transform ${definition.name} cannot process a Lorem Ipsum`
				});
			}

			const description = definition.description ?? "(no description)";
			const aliases = (definition.aliases.length === 0)
				? ""
				: ` (${definition.aliases.join(", ")})`;

			const reversible = (definition.type === "map" || definition.reverseData) ? "Yes" : "No";
			return core.Utils.tag.trim `
				<li>
					<code>${definition.name}${aliases}</code>
					<ul>
						<li>Reversible: ${reversible}</li>
						<li>${description}</li>
						<li>${transformedMessage}</li>
					</ul>
				</li>
			`;
		});

		return [
			"Transforms some given text to different styles, according to the transform type provided.",
			"Each type and their aliases are listed below, along with an example.",
			"",

			`Note: if used within the <a href="/bot/command/detail/pipe">pipe command</a>, this command has no cooldown, and you can use it multiple times within the same pipe!`,
			"",

			`<code>${prefix}tt (type) (text)</code>`,
			`<code>${prefix}texttransform (type) (text)</code>`,
			"Provided text transformed based on the type selected.",

			`Example text: ${LOREM_IPSUM}`,
			"",

			`<ul>${examples.join("<br>")}</ul>`
		];
	}
});
