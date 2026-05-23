import * as z from "zod";
import { declare } from "../../classes/command.js";
import type { UserDataPropertyMap } from "../../classes/custom-data-properties.js";

const supportedAnimalTypes = ["cat", "dog", "bird", "fox"] as const;
const animalTypeSchema = z.enum(supportedAnimalTypes);
type AnimalType = typeof supportedAnimalTypes[number];
type AnimalsData = UserDataPropertyMap["animals"];

const simpleFactSchema = z.object({ fact: z.string() });
const multiFactSchema = z.object({ facts: z.array(z.string()) });
const linkSchema = z.object({ link: z.string() });
const messageSchema = z.object({ message: z.string() });
const urlsSchema = z.array(z.object({ url: z.string() }));

const resolveAnimalType = (command: "fact" | "picture", invocation: string, arg?: string) => {
	if (command === "fact") {
		switch (invocation) {
			case "rbf": return "bird";
			case "rcf": return "cat";
			case "rdf": return "dog";
			case "rff": return "fox";
		}
	}
	else {
		switch (invocation) {
			case "rbp": return "bird";
			case "rcp": return "cat";
			case "rdp": return "dog";
			case "rfp": return "fox";
		}
	}

	const parsed = animalTypeSchema.safeParse(arg);
	return (parsed.success) ? parsed.data : null;
};

const verifyAnimalAccess = (type: AnimalType, animalsData: AnimalsData | null) => {
	if (!animalsData) {
		return {
			success: false,
			reply: `You must verify that you have a ${type} as a pet first! Verify by $suggest-ing a picture of your ${type} along with your name and mention that you want the command access.`
		};
	}

	if (!Object.hasOwn(animalsData, type)) {
		const availableTypes = Object.keys(animalsData).join(", ");
		return {
			success: false,
			reply: `You can only use this command for ${availableTypes}! If you want to use it like this, you need to $suggest a picture of your pet ${type}, like before.`
		};
	}

	return {
		success: true
	};
};

export const RandomAnimalFactCommand = declare({
	Name: "randomanimalfact",
	Aliases: ["raf", "rbf", "rcf", "rdf", "rff"],
	Cooldown: 10_000,
	Description: "Posts a random fact about a selected animal type.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: async function randomAnimalFact (context, input?: string) {
		const type = resolveAnimalType("fact", context.invocation, input);
		if (!type) {
			return {
				success: false,
				reply: `No animal type provided! To get a fact, use one of: ${supportedAnimalTypes.join(", ")}`
			};
		}

		const data = await context.user.getDataProperty("animals");
		const verificationResult = verifyAnimalAccess(type, data);
		if (!verificationResult.success) {
			return verificationResult;
		}

		let fact: string;
		switch (type) {
			case "bird": {
				const response = await core.Got.get("GenericAPI")("https://some-random-api.ml/facts/bird");
				fact = simpleFactSchema.parse(response.body).fact;
				break;
			}
			case "cat": {
				const response = await core.Got.get("GenericAPI")("https://catfact.ninja/fact");
				fact = simpleFactSchema.parse(response.body).fact;
				break;
			}
			case "dog": {
				const response = await core.Got.get("GenericAPI")("tps://dog-api.kinduff.com/api/facts");
				fact = multiFactSchema.parse(response.body).facts[0];
				break;
			}
			case "fox": {
				const response = await core.Got.get("GenericAPI")("https://some-random-api.ml/facts/fox");
				fact = simpleFactSchema.parse(response.body).fact;
				break;
			}
		}

		return {
			success: true,
			reply: fact
		};
	},
	Dynamic_Description: (prefix) => []
});

export const RandomAnimalPictureCommand = declare({
	Name: "randomanimalpicture",
	Aliases: ["rap", "rbp", "rcp", "rdp", "rfp"],
	Cooldown: 10_000,
	Description: "Posts a random picture for a given animal type.",
	Flags: ["mention", "non-nullable", "pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: async function randomAnimalPicture (context, input?: string) {
		const type = resolveAnimalType("fact", context.invocation, input);
		if (!type) {
			return {
				success: false,
				reply: `No animal type provided! To get a picture, use one of: ${supportedAnimalTypes.join(", ")}`
			};
		}

		const data = await context.user.getDataProperty("animals");
		const verificationResult = verifyAnimalAccess(type, data);
		if (!verificationResult.success) {
			return verificationResult;
		}

		let url: string;
		switch (type) {
			case "bird": {
				const response = await core.Got.get("GenericAPI")("https://some-random-api.ml/img/birb");
				url = linkSchema.parse(response.body).link;
				break;
			}
			case "cat": {
				const response = await core.Got.get("GenericAPI")("https://api.thecatapi.com/v1/images/search");
				url = urlsSchema.parse(response.body)[0].url;
				break;
			}
			case "dog": {
				const response = await core.Got.get("GenericAPI")("https://dog.ceo/api/breeds/image/random");
				url = messageSchema.parse(response.body).message;
				break;
			}
			case "fox": {
				const response = await core.Got.get("GenericAPI")("https://some-random-api.ml/img/fox");
				url = linkSchema.parse(response.body).link;
				break;
			}
		}

		return {
			success: true,
			reply: url
		};
	},
	Dynamic_Description: (prefix) => []
});
