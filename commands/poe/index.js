module.exports = {
	Name: "poe",
	Aliases: null,
	Author: "supinic",
	Cooldown: 7500,
	Description: "A collection of various Path of Exile related commands. Check the extended help on website for more info.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (command => {
		command.data.labyrinth = {
			date: null,
			normal: null,
			cruel: null,
			merciless: null,
			uber: null
		};

		const ascendancies = ["Slayer", "Gladiator", "Champion", "Assassin", "Saboteur", "Trickster", "Juggernaut", "Berserker", "Chieftain", "Necromancer", "Elementalist", "Occultist", "Deadeye", "Raider", "Pathfinder", "Inquisitor", "Hierophant", "Guardian", "Ascendant"];
		const additionalGems = ["Ambush","Ancestral Cry","Anger","Arcane Cloak","Arctic Armour","Assassin's Mark","Battlemage's Cry","Berserk","Blood and Sand","Bone Offering","Clarity","Conductivity","Convocation","Dash","Defiance Banner","Decoy Totem","Desecrate","Despair","Determination","Devouring Totem","Discipline","Dread Banner","Elemental Weakness","Enduring Cry","Enfeeble","Ensnaring Arrow","Flammability","Flesh Offering","Flesh and Stone","Frost Wall","General's Cry","Grace","Haste","Hatred","Herald of Ash","Herald of Ice","Herald of Thunder","Immortal Call","Intimidating Cry","Malevolence","Arcanist Brand","Phase Run","Plague Bearer","Poacher's Mark","Precision","Pride","Projectile Weakness","Punishment","Purity of Elements","Purity of Fire","Purity of Ice","Purity of Lightning","Rallying Cry","Reckoning","Rejuvenation Totem","Riposte","Seismic Cry","Smoke Mine","Spellslinger","Spirit Offering","Steelskin","Temporal Chains","Vaal Clarity","Vaal Discipline","Vaal Grace","Vaal Haste","Vaal Impurity of Fire","Vaal Impurity of Ice","Vaal Impurity of Lightning","Vengeance","Vitality","Vulnerability","War Banner","Warlord's Mark","Wither","Withering Step","Wrath","Zealotry"];
		const skillGems = ["Absolution","Ancestral Protector","Ancestral Warchief","Animate Guardian","Arc","Armageddon Brand","Artillery Ballista","Ball Lightning","Bane","Barrage","Bear Trap","Blade Blast","Blade Flurry","Blade Vortex","Bladefall","Bladestorm","Blast Rain","Blight","Blink Arrow","Blade Trap","Blood Rage","Bodyswap","Burning Arrow","Caustic Arrow","Chain Hook","Charged Dash","Cleave","Cobra Lash","Cold Snap","Consecrated Path","Contagion","Conversion Trap","Creeping Frost","Cremation","Cyclone","Dark Pact","Detonate Dead","Discharge","Divine Ire","Dominating Blow","Double Strike","Dual Strike","Earthquake","Earthshatter","Elemental Hit","Essence Drain","Ethereal Knives","Explosive Arrow","Explosive Trap","Explosive Concoction","Exsanguinate","Eye of Winter","Fire Trap","Fireball","Firestorm","Flame Dash","Flame Surge","Flameblast","Flamethrower Trap","Flicker Strike","Forbidden Rite","Freezing Pulse","Frenzy","Frost Blades","Frost Bomb","Frostbite","Frostblink","Frostbolt","Galvanic Arrow","Glacial Cascade","Glacial Hammer","Ground Slam","Heavy Strike","Herald of Agony","Herald of Purity","Holy Flame Totem","Ice Crash","Ice Nova","Ice Shot","Ice Spear","Ice Trap","Icicle Mine","Incinerate","Infernal Blow","Infernal Cry","Kinetic Blast","Kinetic Bolt","Lacerate","Lancing Steel","Leap Slam","Lightning Arrow","Lightning Spire Trap","Lightning Strike","Lightning Tendrils","Lightning Trap","Lightning Warp","Magma Orb","Manabond","Mirror Arrow","Molten Shell","Molten Strike","Orb of Storms","Penance Brand","Perforate","Pestilent Strike","Power Siphon","Puncture","Purifying Flame","Pyroclast Mine","Rage Vortex","Rain of Arrows","Raise Spectre","Raise Zombie","Reap","Reave","Righteous Fire","Scorching Ray","Scourge Arrow","Searing Bond","Seismic Trap","Shattering Steel","Shield Charge","Shield Crush","Shock Nova","Shockwave Totem","Shrapnel Ballista","Siege Ballista","Siphoning Trap","Smite","Soulrend","Spark","Spectral Shield Throw","Spectral Helix","Spectral Throw","Split Arrow","Static Strike","Storm Brand","Storm Burst","Storm Call","Storm Rain","Stormbind","Stormblast Mine","Summon Carrion Golem","Summon Chaos Golem","Summon Flame Golem","Summon Holy Relic","Summon Ice Golem","Summon Lightning Golem","Summon Raging Spirit","Summon Reaper","Summon Skeletons","Summon Skitterbots","Summon Stone Golem","Sunder","Sweep","Tectonic Slam","Tempest Shield","Tornado Shot","Toxic Rain","Unearth","Vaal Ancestral Warchief","Vaal Arc","Vaal Blade Vortex","Vaal Blight","Vaal Burning Arrow","Vaal Cold Snap","Vaal Cyclone","Vaal Detonate Dead","Vaal Double Strike","Vaal Earthquake","Vaal Fireball","Vaal Flameblast","Vaal Glacial Hammer","Vaal Ground Slam","Vaal Ice Nova","Vaal Lightning Strike","Vaal Lightning Trap","Vaal Molten Shell","Vaal Power Siphon","Vaal Rain of Arrows","Vaal Reave","Vaal Righteous Fire","Vaal Spark","Vaal Spectral Throw","Vaal Storm Call","Vaal Summon Skeletons","Venom Gyre","Vigilant Strike","Viper Strike","Volatile Dead","Voltaxic Burst","Vortex","Wave of Conviction","Whirling Blades","Wild Strike","Winter Orb","Wintertide Brand"];

		const trials = {
			normal: "A1: Lower Prison; A2: Crypt lvl 1, Chamber of Sins lvl 2; A3: Crematorium, Catacombs, Imperial Gardens",
			cruel: "A6: Prison; A7: Crypt; A7: Chamber of Sins lvl 2",
			merciless: "A8: Bath House; A9: Tunnel; A10: Ossuary"
		};

		trials.all = Object.values(trials).join(" -- ");

		return {
			nextLeague: {
				patch: "3.18",
				name: "Sentinel",
				reveal: new sb.Date("2022-05-05 22:00"),
				launch: new sb.Date("2022-05-13 22:00")
			},
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
								reply: `Invalid labyrinth type provided! Supported types: ${types.join(", ")}`
							};
						}

						if (!command.data.labyrinth.date || command.data.labyrinth.date.day !== new sb.Date().day) {
							command.data.labyrinth.date = new sb.Date().setTimezoneOffset(0);
							command.data.details = {};

							const { statusCode, statusMessage, body: html } = await sb.Got("FakeAgent", {
								url: "https://poelab.com",
								responseType: "text"
							});

							if (statusCode === 503) {
								return {
									success: false,
									reply: `Poelab website returned error ${statusCode} - ${statusMessage}! Can't access labyrinth images.`
								};
							}

							const $ = sb.Utils.cheerio(html);
							const links = Array.from($(".redLink").slice(0, 4).map((_, i) => i.attribs.href));

							for (let i = 0; i < links.length; i++) {
								const type = types[i];
								command.data.details[type] = {
									type,
									link: links[i],
									imageLink: null
								};
							}
						}

						const detail = command.data.details[labType];
						if (detail.imageLink === null) {
							const html = await sb.Got("FakeAgent", {
								url: detail.link,
								responseType: "text"
							}).text();

							const $ = sb.Utils.cheerio(html);

							detail.imageLink = $("#notesImg")[0].attribs.src;
						}

						return {
							reply: `Today's ${labType} labyrinth map: ${detail.imageLink}`
						};
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
						let [user] = args;
						if (!user) {
							if (!context.channel) {
								return {
									success: false,
									reply: "Must provide a user name - no channel is available!"
								};
							}

							user = context.channel.Name;
						}

						const userData = await sb.User.get(user);
						if (!userData) {
							return {
								success: false,
								reply: "Provided user does not exist!"
							};
						}

						const poeData = await userData.getDataProperty("pathOfExile");
						const link = poeData?.uniqueTabs ?? null;
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
						const additional = sb.Utils.randArray(additionalGems);
						const skill = sb.Utils.randArray(skillGems);
						const ascendancy = sb.Utils.randArray(ascendancies);

						return {
							reply: `${skill} + ${additional} ${ascendancy}`
						};
					}
				},
				{
					name: "heist",
					aliases: [],
					description: "Posts a cheatsheet picture with a neat summary of Heist jobs + rewards.",
					execute: async () => ({
						reply: `Heist cheatsheet: https://i.imgur.com/iN05OsU.png`
					})
				}

			]
		};
	}),
	Code: (async function poe (context, type, ...args) {
		if (!type) {
			const now = sb.Date.now();
			const { name, patch, reveal, launch } = this.staticData.nextLeague;
			if (reveal > now) {
				return {
					reply: `The ${patch} ${name} league will be revealed ${sb.Utils.timeDelta(reveal)}.`
				};
			}
			else if (launch > now) {
				return {
					reply: `The ${patch} ${name} league will be revealed ${sb.Utils.timeDelta(launch)}.`
				};
			}

			const possibleEnd = reveal.clone().addMonths(3);
			if (possibleEnd > now) {
				const delta = sb.Utils.timeDelta(possibleEnd, true);
				return {
					reply: `The ${patch} ${name} league has launched - go and play. It will last approximately for ${delta}.`
				};
			}

			return {
				reply: `The ${patch} ${name} league has likely concluded. Ask @Supinic to add new info about the next league!`
			};
		}

		type = type.toLowerCase();

		const target = this.staticData.commands.find(i => i.name === type || i.aliases.includes(type));
		if (!target) {
			return {
				success: false,
				reply: `Provided subcommand does not exist! Check the command's help: ${this.getDetailURL()}`
			};
		}

		return await target.execute(context, ...args);
	}),
	Dynamic_Description: (async (prefix, values) => {
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
	})
};
