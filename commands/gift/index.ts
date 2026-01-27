import { declare } from "../../classes/command.js";

export default declare({
	Name: "gift",
	Aliases: ["give"],
	Cooldown: 5000,
	Description: "This command is deprecated! Use `$cookie gift` instead.",
	Flags: ["developer","mention","pipe"],
	Params: [],
	Whitelist_Response: null,
	Code: () => ({
		success: false,
		reply: `This command is deprecated! Use $cookie gift instead. By using this command, you did not give anything away.`
	}),
	Dynamic_Description: null
});
