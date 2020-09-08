module.exports = {
	Name: "poe",
	Aliases: null,
	Author: "supinic",
	Last_Edit: "2020-09-08T18:38:46.000Z",
	Cooldown: 7500,
	Description: "A collection of various Path of Exile related commands. Check the extended help on website for more info.",
	Flags: ["mention","pipe"],
	Whitelist_Response: null,
	Static_Data: (() => {
		this.data.labyrinth = {
			date: null,
			normal: null,
			cruel: null,
			merciless: null,
			uber: null
		};
	
		const ascendancies = ["Slayer", "Gladiator", "Champion", "Assassin", "Saboteur", "Trickster", "Juggernauth", "Berserker", "Chieftain", "Necromancer", "Elementalist", "Occultist", "Deadeye", "Raider", "Pathfinder", "Inquisitor", "Hierophant", "Guardian", "Ascendant"];
		const skillGems = ["Ancestral Cry","Ancestral Protector","Ancestral Warchief","Anger","Animate Guardian","Arc","Arcane Cloak","Arcanist Brand","Arctic Armour","Armageddon Brand","Artillery Ballista","Assassin's Mark","Ball Lightning","Bane","Barrage","Bear Trap","Berserk","Blade Blast","Blade Flurry","Blade Vortex","Bladefall","Bladestorm","Blast Rain","Blight","Blink Arrow","Blood Rage","Blood and Sand","Bodyswap","Bone Offering","Brand Recall","Burning Arrow","Caustic Arrow","Chain Hook","Charged Dash","Clarity","Cleave","Cobra Lash","Cold Snap","Conductivity","Consecrated Path","Contagion","Conversion Trap","Convocation","Creeping Frost","Cremation","Cyclone","Dark Pact","Dash","Decoy Totem","Desecrate","Despair","Determination","Detonate Dead","Devouring Totem","Discharge","Discipline","Divine Ire","Dominating Blow","Double Strike","Dread Banner","Dual Strike","Earthquake","Earthshatter","Elemental Hit","Elemental Weakness","Enduring Cry","Enfeeble","Ensnaring Arrow","Essence Drain","Ethereal Knives","Explosive Arrow","Explosive Trap","Fire Trap","Fireball","Firestorm","Flame Dash","Flame Surge","Flameblast","Flamethrower Trap","Flammability","Flesh Offering","Flesh and Stone","Flicker Strike","Freezing Pulse","Frenzy","Frost Blades","Frost Bomb","Frost Wall","Frostbite","Frostblink","Frostbolt","Galvanic Arrow","General's Cry","Glacial Cascade","Glacial Hammer","Grace","Ground Slam","Haste","Hatred","Heavy Strike","Herald of Agony","Herald of Ash","Herald of Ice","Herald of Purity","Herald of Thunder","Holy Flame Totem","Ice Crash","Ice Nova","Ice Shot","Ice Spear","Ice Trap","Icicle Mine","Immortal Call","Incinerate","Infernal Blow","Infernal Cry","Intimidating Cry","Kinetic Blast","Kinetic Bolt","Lacerate","Lancing Steel","Leap Slam","Lightning Arrow","Lightning Spire Trap","Lightning Strike","Lightning Tendrils","Lightning Trap","Lightning Warp","Magma Orb","Malevolence","Mirror Arrow","Molten Shell","Molten Strike","Orb of Storms","Penance Brand","Perforate","Pestilent Strike","Phase Run","Plague Bearer","Poacher's Mark","Power Siphon","Precision","Pride","Projectile Weakness","Puncture","Punishment","Purifying Flame","Purity of Elements","Purity of Fire","Purity of Ice","Purity of Lightning","Pyroclast Mine","Rain of Arrows","Raise Spectre","Raise Zombie","Rallying Cry","Reave","Reckoning","Rejuvenation Totem","Righteous Fire","Riposte","Scorching Ray","Scourge Arrow","Searing Bond","Seismic Cry","Seismic Trap","Shattering Steel","Shield Charge","Shock Nova","Shockwave Totem","Shrapnel Ballista","Siege Ballista","Siphoning Trap","Smite","Smoke Mine","Soulrend","Spark","Spectral Shield Throw","Spectral Throw","Spellslinger","Spirit Offering","Split Arrow","Static Strike","Steelskin","Storm Brand","Storm Burst","Storm Call","Stormbind","Stormblast Mine","Summon Carrion Golem","Summon Chaos Golem","Summon Flame Golem","Summon Holy Relic","Summon Ice Golem","Summon Lightning Golem","Summon Raging Spirit","Summon Skeletons","Summon Skitterbots","Summon Stone Golem","Sunder","Sweep","Tectonic Slam","Tempest Shield","Temporal Chains","Tornado Shot","Toxic Rain","Unearth","Vaal Ancestral Warchief","Vaal Arc","Vaal Blade Vortex","Vaal Blight","Vaal Burning Arrow","Vaal Clarity","Vaal Cold Snap","Vaal Cyclone","Vaal Detonate Dead","Vaal Discipline","Vaal Double Strike","Vaal Earthquake","Vaal Fireball","Vaal Flameblast","Vaal Glacial Hammer","Vaal Grace","Vaal Ground Slam","Vaal Haste","Vaal Ice Nova","Vaal Impurity of Fire","Vaal Impurity of Ice","Vaal Impurity of Lightning","Vaal Lightning Strike","Vaal Lightning Trap","Vaal Molten Shell","Vaal Power Siphon","Vaal Rain of Arrows","Vaal Reave","Vaal Righteous Fire","Vaal Spark","Vaal Spectral Throw","Vaal Storm Call","Vaal Summon Skeletons","Vengeance","Venom Gyre","Vigilant Strike","Viper Strike","Vitality","Volatile Dead","Vortex","Vulnerability","War Banner","Warlord's Mark","Wave of Conviction","Whirling Blades","Wild Strike","Winter Orb","Wintertide Brand","Wither","Withering Step","Wrath","Zealotry"];
	
		const trials = {
			normal: "A1: Lower Prison; A2: Crypt lvl 1, Chamber of Sins lvl 2; A3: Crematorium, Catacombs, Imperial Gardens",
			cruel: "A6: Prison; A7: Crypt; A7: Chamber of Sins lvl 2",
			merciless: "A8: Bath House; A9: Tunnel; A10: Ossuary"
		};
	
		trials.all = Object.values(trials).join(" -- ");
	
		return {
			commands: [
				{
					name: "labyrinth",
					aliases: ["lab"],
					description: "Fetches the current overview picture of today's Labyrinth. Use a difficulty (normal, cruel, merciless, uber) to see each one separately.",
					execute: async (context, ...args) => {
						const labType = (args[0] || "").toLowerCase();
						const types = ["uber", "merciless", "cruel", "normal"];
						if (!types.includes(labType)) {
							return {
								reply: "Invalid labyrinth type provided! Supported types: " + types.join(", ")
							};
						}
	
						if (!this.data.labyrinth.date || this.data.labyrinth.date.day !== new sb.Date().day) {
							this.data.labyrinth.date = new sb.Date().setTimezoneOffset(0);
							this.data.details = {};
	
							const html = await sb.Got.instances.FakeAgent("https://poelab.com").text();
							const $ = sb.Utils.cheerio(html);
							const links = Array.from($(".redLink").slice(0, 4).map((_, i) => i.attribs.href));
	
							for (let i = 0; i < links.length; i++) {
								const type = types[i];
								this.data.details[type] = {
									type,
									link: links[i],
									imageLink: null
								};
							}
						}
	
						const detail = this.data.details[labType];
						if (detail.imageLink === null) {
							const html = await sb.Got.instances.FakeAgent(detail.link).text();
							const $ = sb.Utils.cheerio(html);
	
							detail.imageLink = $("#notesImg")[0].attribs.src;
						}
	
						return {
							reply: `Today's ${labType} labyrinth map: ${detail.imageLink}`
						};
					}
				},
				{
					name: "price",
					aliases: [],
					description: "Checks for current price of a given currency (items coming later). Usage: poe price (league) (item)",
					execute: async (context, ...args) => {
						const [leagueName, ...rest] = args;
						const itemName = rest.join(" ");
						if (!leagueName || !itemName) {
							return {
								success: false,
								reply: `No league or item provided!`
							};
						}
	
						const [league, item] = await Promise.all([
							sb.Query.getRecordset(rs => rs
								.select("*")
								.from("poe", "League")
								.where("Shortcut = %s", leagueName)
								.where("Active = %b", true)
								.single()
							),
	
							sb.Query.getRecordset(rs => rs
								.select("*")
								.from("poe", "Item")
								.where("Name = %s", itemName)
								.single()
							)
						]);
						if (!league) {
							return {
								success: false,
								reply: `Provided league does not exist or is not active!`
							};
						}
						else if (!item) {
							return {
								success: false,
								reply: `Provided item does not exist or is not being tracked!`
							};
						}
	
						const price = await sb.Query.getRecordset(rs => rs
							.select("Chaos_Equivalent AS Chaos")
							.from("poe", "Price")
							.where("League = %n", league.ID)
							.where("Item = %n", item.ID)
							.single()
						);
						if (!price) {
							return {
								success: false,
								reply: `No price found for that item!`
							};
						}
	
						let reply = `${itemName} is currently worth ${price.Chaos} chaos in ${league.Name}.`;
						if (price.Chaos < 0.5) {
							const flipped = sb.Utils.round(1 / price.Chaos, 2);
							reply = `1 chaos can currently buy ${flipped} of ${item.Name} in ${league.Name}.`;
						}
	
						return { reply };
					}
				},
				{
					name: "syndicate",
					aliases: ["syn"],
					description: "Fetches info about the Syndicate. If nothing is specified, you get a chart. You can also specify a Syndicate member to get their overview, or add a position to be even more specific.",
					execute: async (context, ...args) => {
						const person = args.shift();
						if (!person) {
							return {
								reply: "Check the Syndicate sheet here (⚠HTTP only!⚠): http://poesyn.xyz/syndicate or the picture here: https://i.nuuls.com/huXFC.png"
							};
						}
	
						const type = (args.shift()) ?? null;
						const data = await sb.Query.getRecordset(rs => rs
							.select("*")
							.from("poe", "Syndicate")
							.where("Name = %s", person)
							.limit(1)
							.single()
						);
	
						if (!data) {
							return {
								success: false,
								reply: "Syndicate member or type does not exist!"
							};
						}
	
						return {
							reply: (type === null)
								? Object.entries(data).map(([key, value]) => `${key}: ${value}`).join("; ")
								: `${data.Name} at ${type}: ${data[sb.Utils.capitalize(type)]}`
						};
					}
				},
				{
					name: "trial",
					aliases: ["trials"],
					description: "Fetches info about the Labyrinth trials for specified difficulty, or overall if not specified.",
					execute: async (context, ...args) => {
						const trialType = args.shift() ?? "all";
						return {
							reply: trials[trialType] ?? "Invalid trial type provided!"
						};
					}
				},
				{
					name: "uniques",
					aliases: [],
					description: "If a user has requested to have their unique stash tab available on supibot, you can get its link by invoking this sub-command.",
					execute: async (context, ...args) => {
						let [user, type] = args;
						if (!user) {
							if (!context.channel) {
								return {
									success: false,
									reply: "Must provide a user name - no channel is available!"
								}
							}
	
							user = context.channel.Name;
						}
	
						const userData = await sb.User.get(user);
						if (!userData) {
							return {
								success: false,
								reply: "Provided user does not exist!"
							}
						}
	
						const link = userData.Data?.pathOfExile?.uniqueTabs ?? null;
						if (!link) {
							return {
								success: false,
								reply: `Provided user has no unique stash tabs set up!`
							};
						}
	
						return {
							reply: `${userData.Name}'s unique tab(s): ${link}`
						};
					}
				},
				{
					name: "roll",
					aliases: ["randombuild", "rb"],
					description: "Generates a build by taking a random skill gem and a random ascendancy and putting them together.",
					execute: async () => {
						const skill = sb.Utils.randArray(skillGems);
						const ascendancy = sb.Utils.randArray(ascendancies);
	
						return {
							reply: `${skill} ${ascendancy}`
						};
					}
				}
			]
		};
	}),
	Code: (async function poe (context, type, ...args) {
		if (!type) {
			const heist = new sb.Date("2020-09-18 22:00");
			return {
				reply: (heist > Date.now())
					? `The Heist league launches ${sb.Utils.timeDelta(heist)}.`
					: "The Heist league has launched! Go and play!"
			};
	
		/*
			return {
				reply: `No subcommand provided! Check the command's help: https://supinic.com/bot/command/${this.ID}`
			};
		*/
		}
	
		type = type.toLowerCase();
	
		const target = this.staticData.commands.find(i => i.name === type || i.aliases.includes(type));
		if (!target) {
			return {
				success: false,
				reply: `Provided subcommand does not exist! Check the command's help: https://supinic.com/bot/command/${this.ID}`
			};
		}
	
		return await target.execute(context, ...args);
	}),
	Dynamic_Description: async (prefix, values) => {
		const { commands } = values.getStaticData();
	
		return [
			"Multiple commands related to Path of Exile.",
			"",
	
			...commands.flatMap(command => [
				`<code>${prefix}poe ${command.name}</code>`,
				command.description,
				""
			])
		];
	}
};