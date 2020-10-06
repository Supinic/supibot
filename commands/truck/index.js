module.exports = {
	Name: "truck",
	Aliases: null,
	Author: "supinic",
	Cooldown: 10000,
	Description: "Trucks the target user into bed. KKona",
	Flags: ["opt-out","pipe","skip-banphrase"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function truck (context, target) {
		if (target && target.startsWith("@")) {
			target = target.slice(1);
		}
	
		if (target?.toLowerCase() === context.platform.Self_Name) {
			return { 
				reply: "KKonaW I'M DRIVING THE TRUCK KKonaW GET OUT OF THE WAY KKonaW"
			};
		}
		else if (target && target.toLowerCase() !== context.user.Name) {
			return {
				reply: `You truck ${target} into bed with the power of a V8 engine KKonaW 👉🛏🚚`
			};
		}
		else {
			return { 
				reply: "The truck ran you over KKoooona"
			};
		}
	}),
	Dynamic_Description: null
};