module.exports = {
	Name: "boshy",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T17:25:36.000Z",
	Cooldown: 15000,
	Description: "Oh no no PepeLaugh",
	Flags: ["mention","pipe","whitelist"],
	Whitelist_Response: null,
	Static_Data: null,
	Code: (async function boshy () {
		const sonicStart = 6620;
		const sonicEnd = 10664; 
	
		const skeletonStart = 11334;
		const skeletonEnd = 11603;
	
		const megamanStart = 12244;	
		const megamanEnd = 12760;	
	
		const mortalKombatStart = 13977;
		const mortalKombatEnd = 14307;
	
		const ganonStart = 14768;
		const ganonEnd = 14830;
	
		const missingnoStart = 17268; 
		const missingnoEnd = 17497;
	
		const solgrynStart = 18973;
		const solgrynEnd = solgrynStart + 2041;
	
		return {
			reply: "Forsen has died the following amount of times at each boss: " +
				"Sonic: " + (sonicEnd - sonicStart) +
				", Skeleton: " + (skeletonEnd - skeletonStart) +
				", Megaman: " + (megamanEnd - megamanStart) +
				", Mortal Kombat: " + (mortalKombatEnd - mortalKombatStart) + 
				", Ganon: " + (ganonEnd - ganonStart) +
				", Missingno: " + (missingnoEnd - missingnoStart) + 
				", Solgryn: " + (solgrynEnd - solgrynStart) + 
				"; for a complete total of " + solgrynEnd + ". LOST TO OATMEAL OMEGALUL"
		};
	}),
	Dynamic_Description: null
};