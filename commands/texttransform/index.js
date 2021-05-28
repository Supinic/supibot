module.exports = {
	Name: "texttransform",
	Aliases: ["tt","reversetexttransform","rtt"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Transforms provided text into one of provided types, such as \"vaporwave\", for example.",
	Flags: ["external-input","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => {
		/* eslint-disable-next-line quote-props, key-spacing */
		const morse = { "0":"-----","1":".----","2":"..---","3":"...--","4":"....-","5":".....","6":"-....","7":"--...","8":"---..","9":"----.","a":".-","b":"-...","c":"-.-.","d":"-..","e":".","f":"..-.","g":"--.","h":"....","i":"..","j":".---","k":"-.-","l":".-..","m":"--","n":"-.","o":"---","p":".--.","q":"--.-","r":".-.","s":"...","t":"-","u":"..-","v":"...-","w":".--","x":"-..-","y":"-.--","z":"--..",".":".-.-.-",",":"--..--","?":"..--..","!":"-.-.--","-":"-....-","/":"-..-.","@":".--.-.","(":"-.--.",")":"-.--.-" };

		const convert = {
			method: (string, fn) => fn(string),
			map: (string, map) => [...string].map(i => map[i] || i).join(""),
			unmap: (string, map) => {
				const reverseMap = {};
				for (const [key, value] of Object.entries(map)) {
					reverseMap[value] = key;
				}
				return convert.map(string, reverseMap);
			},
			translate: (string, dictionary) => {
				for (const [from, to] of dictionary.phrasesWords) {
					const r = new RegExp(`\\b${from}\\b`, "gi");
					string = string.replace(r, `_${to}_`);
				}

				for (const [from, to] of dictionary.prefixes) {
					const r = new RegExp(`\\b${from}`, "gi");
					string = string.replace(r, to);
				}

				for (const [from, to] of dictionary.suffixes) {
					const r = new RegExp(`${from}\\b`, "gi");
					string = string.replace(r, to);
				}

				for (const [from, to] of dictionary.intrawords) {
					const r = new RegExp(from, "gi");
					string = string.replace(r, to);
				}

				string = string.trim().replace(/_/g, "");

				if (dictionary.endings && /[).?!]$/.test(string)) {
					string += ` ${sb.Utils.randArray(dictionary.endings)}`;
				}

				return string;
			}
		};

		/* eslint-disable quote-props, key-spacing, object-property-newline */
		const officialCharactersMap = {
			A: "𝐀", B: "𝐁", C: "𝐂", D: "𝐃", E: "𝐄", F: "𝐅", G: "𝐆", H: "𝐇", I: "𝐈", J: "𝐉",
			K: "𝐊", L: "𝐋", M: "𝐌", N: "𝐍", O: "𝐎", P: "𝐏", Q: "𝐐", R: "𝐑", S: "𝐒", T: "𝐓",
			U: "𝐔", V: "𝐕", W: "𝐖", X: "𝐗", Y: "𝐘", Z: "𝐙",

			a: "𝐚", b: "𝐛",	c: "𝐜",	d: "𝐝",	e: "𝐞",	f: "𝐟",	g: "𝐠", h: "𝐡", i: "𝐢", j: "𝐣",
			k: "𝐤", l: "𝐥", m: "𝐦", n: "𝐧", o: "𝐨", p: "𝐩", q: "𝐪", r: "𝐫", s: "𝐬", t: "𝐭",
			u: "𝐮", v: "𝐯", w: "𝐰", x: "𝐱", y: "𝐲", z: "𝐳"
		};

		const types = [
			{
				name: "bubble",
				type: "map",
				aliases: [],
				data: { "a":"ⓐ","b":"ⓑ","c":"ⓒ","d":"ⓓ","e":"ⓔ","f":"ⓕ","g":"ⓖ","h":"ⓗ","i":"ⓘ","j":"ⓙ","k":"ⓚ","l":"ⓛ","m":"ⓜ","n":"ⓝ","o":"ⓞ","p":"ⓟ","q":"ⓠ","r":"ⓡ","s":"ⓢ","t":"ⓣ","u":"ⓤ","v":"ⓥ","w":"ⓦ","x":"ⓧ","y":"ⓨ","z":"ⓩ","A":"Ⓐ","B":"Ⓑ","C":"Ⓒ","D":"Ⓓ","E":"Ⓔ","F":"Ⓕ","G":"Ⓖ","H":"Ⓗ","I":"Ⓘ","J":"Ⓙ","K":"Ⓚ","L":"Ⓛ","M":"Ⓜ","N":"Ⓝ","O":"Ⓞ","P":"Ⓟ","Q":"Ⓠ","R":"Ⓡ","S":"Ⓢ","T":"Ⓣ","U":"Ⓤ","V":"Ⓥ","W":"Ⓦ","X":"Ⓧ","Y":"Ⓨ","Z":"Ⓩ","0":"🄋","1":"➀","2":"➁","3":"➂","4":"➃","5":"➄","6":"➅","7":"➆","8":"➇","9":"➈" }
			},
			{
				name: "fancy",
				type: "map",
				aliases: [],
				data: { "a":"𝓪","b":"𝓫","c":"𝓬","d":"𝓭","e":"𝓮","f":"𝓯","g":"𝓰","h":"𝓱","i":"𝓲","j":"𝓳","k":"𝓴","l":"𝓵","m":"𝓶","n":"𝓷","o":"𝓸","p":"𝓹","q":"𝓺","r":"𝓻","s":"𝓼","t":"𝓽","u":"𝓾","v":"𝓿","w":"𝔀","x":"𝔁","y":"𝔂","z":"𝔃","A":"𝓐","B":"𝓑","C":"𝓒","D":"𝓓","E":"𝓔","F":"𝓕","G":"𝓖","H":"𝓗","I":"𝓘","J":"𝓙","K":"𝓚","L":"𝓛","M":"𝓜","N":"𝓝","O":"𝓞","P":"𝓟","Q":"𝓠","R":"𝓡","S":"𝓢","T":"𝓣","U":"𝓤","V":"𝓥","W":"𝓦","X":"𝓧","Y":"𝓨","Z":"𝓩" }
			},
			{
				name: "flipped",
				type: "map",
				aliases: ["ud", "upsidedown"],
				data: { "0":"0","1":"Ɩ","2":"ᄅ","3":"Ɛ","4":"ㄣ","5":"ϛ","6":"9","7":"ㄥ","8":"8","9":"6","a":"ɐ","b":"q","c":"ɔ","d":"p","e":"ǝ","f":"ɟ","g":"ƃ","h":"ɥ","i":"ᴉ","j":"ɾ","k":"ʞ","m":"ɯ","n":"u","r":"ɹ","t":"ʇ","v":"ʌ","w":"ʍ","y":"ʎ","A":"∀","C":"Ɔ","E":"Ǝ","F":"Ⅎ","G":"פ","H":"H","I":"I","J":"ſ","L":"˥","M":"W","N":"N","P":"Ԁ","T":"┴","U":"∩","V":"Λ","Y":"⅄",".":"˙",",":"`","'":",","\"":",,","`":",","?":"¿","!":"¡","[":"]","]":"[","(":")",")":"(","{":"}","}":"{","<":">",">":"<","&":"⅋","_":"‾","∴":"∵","⁅":"⁆","Ɩ":"1","ᄅ":"2","Ɛ":"3","ㄣ":"4","ϛ":"5","ㄥ":"7","ɐ":"a","q":"b","ɔ":"c","p":"d","ǝ":"e","ɟ":"f","ƃ":"g","ɥ":"h","ᴉ":"i","ɾ":"j","ʞ":"k","ɯ":"m","u":"n","ɹ":"r","ʇ":"t","ʌ":"v","ʍ":"w","ʎ":"y","∀":"A","Ɔ":"C","Ǝ":"E","Ⅎ":"F","פ":"G","ſ":"J","˥":"L","W":"M","Ԁ":"P","┴":"T","∩":"U","Λ":"V","⅄":"Y","˙":".",",,":"\"","¿":"?","¡":"!","⅋":"&","‾":"_","∵":"∴","⁆":"⁅" }
			},
			{
				name: "elite",
				type: "map",
				aliases: ["leet", "l33t", "1337"],
				data: { "a":"4","A":"4","e":"3","E":"3","g":"6","G":"6","o":"0","O":"0","s":"5","S":"5","t":"7","T":"7" }
			},
			{
				name: "medieval",
				type: "map",
				aliases: [],
				data: { "a":"𝖆","b":"𝖇","c":"𝖈","d":"𝖉","e":"𝖊","f":"𝖋","g":"𝖌","h":"𝖍","i":"𝖎","j":"𝖏","k":"𝖐","l":"𝖑","m":"𝖒","n":"𝖓","o":"𝖔","p":"𝖕","q":"𝖖","r":"𝖗","s":"𝖘","t":"𝖙","u":"𝖚","v":"𝖛","w":"𝖜","x":"𝖝","y":"𝖞","z":"𝖟","A":"𝕬","B":"𝕭","C":"𝕮","D":"𝕯","E":"𝕰","F":"𝕱","G":"𝕲","H":"𝕳","I":"𝕴","J":"𝕵","K":"𝕶","L":"𝕷","M":"𝕸","N":"𝕹","O":"𝕺","P":"𝕻","Q":"𝕼","R":"𝕽","S":"𝕾","T":"𝕿","U":"𝖀","V":"𝖁","W":"𝖂","X":"𝖃","Y":"𝖄","Z":"𝖅" }
			},
			{
				name: "runic",
				type: "map",
				aliases: ["runes"],
				data: { "a":"ᚪ","b":"ᛒ","c":"ᚳ","d":"ᛞ","e":"ᛖ","f":"ᚠ","g":"ᚷ","h":"ᚻ","i":"ᛁ","j":"ᛡ","k":"k","l":"ᛚ","m":"ᛗ","n":"ᚾ","o":"ᚩ","p":"ᛈ","r":"ᚱ","s":"ᛋ","t":"ᛏ","u":"ᚢ","w":"ᚹ","x":"ᛉ","y":"ᚣ","A":"ᚪ","B":"ᛒ","C":"ᚳ","D":"ᛞ","E":"ᛖ","F":"ᚠ","G":"ᚷ","H":"ᚻ","I":"ᛁ","J":"ᛡ","K":"k","L":"ᛚ","M":"ᛗ","N":"ᚾ","O":"ᚩ","P":"ᛈ","R":"ᚱ","S":"ᛋ","T":"ᛏ","U":"ᚢ","W":"ᚹ","X":"ᛉ","Y":"ᚣ" }
			},
			{
				name: "superscript",
				type: "map",
				aliases: ["smol", "super"],
				data: { "0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹"," ":" ","+":"⁺","-":"⁻","a":"ᵃ","b":"ᵇ","c":"ᶜ","d":"ᵈ","e":"ᵉ","f":"ᶠ","g":"ᵍ","h":"ʰ","i":"ⁱ","j":"ʲ","k":"ᵏ","l":"ˡ","m":"ᵐ","n":"ⁿ","o":"ᵒ","p":"ᵖ","r":"ʳ","s":"ˢ","t":"ᵗ","u":"ᵘ","v":"ᵛ","q":"ᶯ","w":"ʷ","x":"ˣ","y":"ʸ","z":"ᶻ","A":"ᴬ","B":"ᴮ","C":"ᶜ","D":"ᴰ","E":"ᴱ","F":"ᶠ","G":"ᴳ","H":"ᴴ","I":"ᴵ","J":"ᴶ","K":"ᴷ","L":"ᴸ","M":"ᴹ","N":"ᴺ","O":"ᴼ","P":"ᴾ","R":"ᴿ","S":"ˢ","T":"ᵀ","U":"ᵁ","V":"ⱽ","W":"ᵂ","X":"ˣ","Y":"ʸ","Z":"ᶻ" }
			},
			{
				name: "vaporwave",
				type: "map",
				aliases: ["vw", "vapor"],
				data: { "a":"ａ","b":"ｂ","c":"ｃ","d":"ｄ","e":"ｅ","f":"ｆ","g":"ｇ","h":"ｈ","i":"ｉ","j":"ｊ","k":"ｋ","l":"ｌ","m":"ｍ","n":"ｎ","o":"ｏ","p":"ｐ","q":"ｑ","r":"ｒ","s":"ｓ","t":"ｔ","u":"ｕ","v":"ｖ","w":"ｗ","x":"ｘ","y":"ｙ","z":"ｚ","A":"Ａ","B":"Ｂ","C":"Ｃ","D":"Ｄ","E":"Ｅ","F":"Ｆ","G":"Ｇ","H":"Ｈ","I":"Ｉ","J":"Ｊ","K":"Ｋ","L":"Ｌ","M":"Ｍ","N":"Ｎ","O":"Ｏ","P":"Ｐ","Q":"Ｑ","R":"Ｒ","S":"Ｓ","T":"Ｔ","U":"Ｕ","V":"Ｖ","W":"Ｗ","X":"Ｘ","Y":"Ｙ","Z":"Ｚ","0":"０","1":"１","2":"２","3":"３","4":"４","5":"５","6":"６","7":"７","8":"８","9":"９" }
			},
			{
				name: "cockney",
				type: "translate",
				aliases: ["3Head"],
				data: { "phrasesWords":[["bubble and squeak","greek"],["police station","cop-shop"],["overdressed","dog's dinner"],["paedophiles","nonces"],["homosexual","botty boy"],["disgusting","goppin'"],["very drunk","legless"],["paedophile","nonce"],["pedophiles","nonces"],["prositutes","pros"],["all right","awright"],["wonderful","blinder"],["cigarette","ciggy"],["ugly girl","ding-dong"],["beaten up","done over"],["in prison","inside"],["exhausted","knackered"],["territory","manor"],["excellent","mint"],["pedophile","nonce"],["prositute","pro"],["hot chick","stunner"],["starving","Hank Marvin"],["knickers","Alan Whickers"],["violence","agro"],["argument","barney"],["fighting","bovver"],["have sex","bunk-up"],["terrible","chronic"],["bullshit","cock and bull"],["definite","dred cert"],["went mad","went eppy"],["horrible","hanging"],["lavatory","khazi"],["bathroom","khazi"],["nonsense","malarkey"],["erection","pan handle"],["customer","punter"],["have sex","have a shag"],["believe","Adam and Eve"],["trouble","Barney Rubble"],["mistake","Cadbury Flake"],["cripple","raspberry ripple"],["alright","awrght"],["illegal","bent as a nine bob note"],["amazing","blinder"],["awesome","blinder"],["courage","bottle"],["gay man","bumhole engineer"],["rubbish","cack"],["lesbian","carpet muncher"],["cocaine","Charlie"],["clothes","clobber"],["annoyed","hacked off"],["trouble","grief"],["breasts","hooters"],["condoms","Johnny-bags"],["hookers","pros"],["gay man","queer"],["stairs","apples and pears"],["bottle","aris"],["pissed","Brahms and Liszt"],["piddle","Jimmy Riddle"],["pissed","Oliver Twist"],["sister","skin and blister"],["stairs","tables and chairs"],["geezer","fridge and freezer"],["stolen","bent"],["stoned","caned"],["police","copper"],["farted","dropped one"],["source","saahrce"],["hassle","grief"],["condom","Johnny-bag"],["toilet","khazi"],["fed up","miffed"],["chilly","parky"],["idiots","plonkers"],["hooker","pro"],["hottie","skirt"],["money","bees and honey"],["skint","boracic lint"],["titty","Bristol City"],["balls","cobbler's awls"],["telly","custard and jelly"],["phone","dog and bone"],["queer","ginger beer"],["pinch","half-inch"],["mouth","north and south"],["stink","pen and ink"],["curry","Ruby Murray"],["snout","salmon and trout"],["thief","tea leaf"],["Chink","Tid"],["balls","town halls"],["state","two and eight"],["sleep","Bo Peep"],["money","bread"],["piles","Chalfont St Giles"],["toast","Holy Ghost"],["darts","arras"],["drunk","bladdered"],["mouth","cakehole"],["leave","chip"],["happy","chuffed"],["blood","claret"],["cloth","clobber"],["money","crust"],["idiot","dickhead"],["about","abaaht"],["other","uvver"],["these","dese"],["dirty","hanging"],["boobs","jugs"],["penis","John Thomas"],["sleep","kip"],["tired","knackered"],["stuff","malarkey"],["crazy","mental"],["hands","mitts"],["cheap","naff"],["boner","pan handle"],["fools","plonkers"],["idiot","plonker"],["fight","ruck"],["whore","slapper"],["real","proper"],["arse","aris"],["wank","Barclays Bank"],["wank","J. Arthur Rank"],["wank","Jodrell Bank"],["hair","Barnet Fair"],["cunt","Berkeley Hunt"],["time","bird lime"],["face","boat race"],["arse","bottle and glass"],["look","butcher's hook"],["mate","China plate"],["feet","dog's meat"],["road","frog and toad"],["cunt","Gareth Hunt"],["piss","Gypsy's kiss"],["poof","iron hoof"],["arse","Khyber Pass"],["soup","loop the loop"],["eyes","mincers"],["deaf","Mutt and Jeff"],["puff","Nelly Duff"],["feet","plates of meat"],["talk","rabbit"],["fart","raspberry tart"],["yank","septic tank"],["cunt","struggle and grunt"],["cold","taters"],["shit","Tom Tit"],["cunt","Tristram Hunt"],["wife","trouble and strife"],["suit","whistle and flute"],["dope","Bob Hope"],["dead","brown bread"],["draw","Dennis Law"],["head","loaf of bread"],["geek","anorak"],["porn","bluey"],["fart","blow-off"],["homo","bum bandit"],["easy","cushy"],["both","bof"],["more","mawer"],["them","'em"],["been","bin"],["than","van"],["this","dis"],["four","faahr"],["with","wiv"],["gang","firm"],["food","grub"],["boss","guv"],["ugly","goppin'"],["fool","headcase"],["nose","hooter"],["fuck","hump"],["pint","jar"],["turd","jabby"],["area","manor"],["turf","manor"],["wife","missus"],["hand","mit"],["kids","nippers"],["food","nosh"],["cold","parky"],["fool","plonker"],["nerd","propellerhead"],["geek","propellerhead"],["cash","readies"],["babe","skirt"],["slut","slapper"],["piss","wazz"],["###","mug"],["###","naughty"],["###","geezer"],["###","dry slap"],["###","melt"],["ass","aris"],["ass","bottle and glass"],["sun","currant bun"],["kid","dustbin lid"],["wig","irish pig"],["car","jam-jar"],["lie","porker"],["tea","Rosy Lee"],["cab","sherbert"],["wig","syrup of figs"],["hat","titfer"],["own","Jack Jones"],["sir","chief"],["sad","choked"],["man","cock"],["omg","crikey"],["the","da"],["for","fer"],["and","an'"],["has","'as"],["poo","jabby"],["man","John"],["car","motah"],["car","motahs"],["kid","nipper"],["wig","rug"],["ear","shell-like"],["hoe","slapper"],["of","ov"],["to","ter"],["or","awer"],["",""]],"suffixes":[["tion","shun"],["uals","ules"],["ows","ahs"],["ing","in"],["ing","in'"],["ual","ule"],["no","nna"],["no","nnas"],["ow","ah"],["th","f"],["t","'"]],"prefixes":[["st","st"],["t'","t'"],["h","'"]],"intrawords":[["tion","shun"],["tt","tt"],["tr","tr"],["te","te"],["st","st"],[" t"," t"],["or","aw"],["t","'"]]}
			},
			{
				name: "cowboy",
				type: "translate",
				aliases: ["KKona", "KKonaW"],
				data: { "intrawords":[],"prefixes":[["state","stayet"],["stret","strayet"],["price","perarsless"],["stone","stowen"],["pret","purt"],["some","sum"],["colo","clo"],["prom","praahm"],["curt","cerht"],["dist","diest"],["push","poosh"],["ita","eyeta"],["par","pahr"],["riv","reev"],["san","sayn"],["up","uhp"],["gr","guh-r"],["na","nuh-a"],["fa","fuh-a"],["pl","puh-l"],["ha","'a"]],"suffixes":[["ttishes","dishes"],["tishes","dishes"],["ierced","ee-ersed"],["ights","aahyts"],["asses","a-yuses"],["nties","nnies"],["ttish","dish"],["hinds","-hahnds"],["ought","awt"],["ierce","ee-erse"],["ings","in's"],["inds","ahnds"],["ices","ahces"],["ight","aahyt"],["ides","aahds"],["imes","aahms"],["ines","aahns"],["ocks","awks"],["airs","eyrs"],["tish","dish"],["oord","o-wrs"],["ores","o-wrs"],["ours","o-wrs"],["alks","awks"],["ears","ars"],["ures","yhaws"],["hind","-hahnd"],["tter","der"],["arge","ahrge"],["nted","nehd"],["ites","ahtes"],["ouse","owse"],["ment","mehyant"],["ance","ahns"],["ound","oun'"],["oil","awl"],["ing","in'"],["ind","ahnd"],["ice","aahce"],["ide","aahd"],["ime","aahm"],["ine","aahn"],["ass","a-yus"],["ock","awk"],["air","eyr"],["nty","nny"],["oor","o-wr"],["ore","o-wr"],["our","o-wr"],["alk","awk"],["ear","ar"],["ure","yhaw"],["end","ey-nd"],["ade","ay-ed"],["nta","nna"],["ian","yun"],["day","dee"],["ake","ay-uk"],["tch","ch"],["ver","vher"],["oss","aws"],["oak","owk"],["ite","aht"],["age","ayge"],["ose","ohs"],["all","ahwl"],["up","uhs"],["ft","f'"]],"phrasesWords":[["i don't agree with this","this dog won't hunt"],["this is not a good deal","this dog won't hunt"],["evade responsibility ","beat the devil around the stump "],["how are you feeling?","how do you do?"],["create a disturbance","kick up a row"],["looking for trouble","on the prod"],["how are you going?","how do you do?"],["make an appearance","cut a figure"],["one way or another","by hook or crook"],["alfalfa desperado","alfalfa desperados"],["diagonally across","catty-cornered"],["not comprehending","at sea "],["wasting your time","barkin' at a knot "],["nobody's business","nothing to nobody "],["give your opinion","opine"],["wasting our time","barking at a knot"],["missed the point","all down but nine "],["any way possible","by hook or crook"],["awkward looking ","barrow-tram "],["like a gentleman","like a thoroughbred "],["i'm thinking of","i got a mind to"],["dodging the law","among the willows "],["bad predicament","bad box "],["completely dead","dead as a door nail"],["modest position","back seats"],["unmarried woman","angelica"],["man for the job","huckleberry"],["out on the town","paintin' the town red"],["im thinking of","i got a mind to"],["you better not","you best not"],["police officer","bull"],["that wont work","that dog won't hunt"],["close together","hand and glove"],["frontier woman","calamity jane"],["get in trouble","balls"],["not even close","couldn't hold a candle to"],["whole assembly","all the shoot "],["keep it secret","keep that dry"],["i do not care","it don't differ to me"],["uncomfortable","all-overish "],["deck of cards","california prayer book"],["do it already","fish or cut bait"],["don't give up","cowboy up"],["express train","dangler"],["hateful woman","biddy"],["perfect order","apple pie order "],["start bucking","boil over"],["suffered loss","burnt fingers"],["great britain","old country"],["congratulated","done congratulated"],["i don't care","it don't differ to me"],["not going to","not about to go"],["handsome man","belvidere"],["i'm going to","amana"],["how are you?","how do you do?"],["empty headed","addle-headed "],["half starved","barber’s cat "],["have a drink","bend an elbow "],["pocket knife","apple peeler "],["baseball bat","catstick"],["best clothes","best bib and tucker "],["beyond reach","above one's bend"],["deep thought","brown study"],["exaggeration","flack"],["hiding place","cubby-hole"],["ill tempered","cross-patch"],["intelligence","cow sense"],["not a cowboy","greenhorn"],["stay a while","cool yer heels"],["well i'll be","land-sakes"],["feeling good","fellin' your oats"],["wasting time","piddlin'"],["contradicted","done contradicted"],["corresponded","done corresponded"],["participated","done participated"],["i dont care","it don't differ to me"],["saddle horn","apple"],["god damn it","dad burn it"],["new orleans","nawlins"],["ranch owner","big augur "],["disturbance","fuss"],["excessively","devilish"],["foolishness","balderdash"],["give a damn","care a continental"],["half cocked","pocket advantaged"],["improvement","betterments"],["intoxicated","boosy"],["large scale","big figure "],["little cool","airish"],["paint horse","calico"],["partnership","cahoots"],["resemblance","all over "],["seen it all","been through the mill "],["spoil sport","addle-pot "],["still alive","above snakes"],["topsy turvy","bag of nails"],["topsy-turvy","bag of nails "],["whole thing","lock, stock and barrel"],["bigger than","knee-high to a"],["rather late","lateish"],["investigate","look-see"],["fake cowboy","mail-order cowboy"],["overwhelmed","head over heels"],["throw a fit","pitch a fit"],["accompanied","done accompanied"],["clove/cleft","done clove/cleft"],["confiscated","done confiscated"],["consecrated","done consecrated"],["constituted","done constituted"],["constrained","done constrained"],["constructed","done constructed"],["contributed","done contributed"],["co-operated","done co-operated"],["disappeared","done disappeared"],["distributed","done distributed"],["enlightened","done enlightened"],["ill-treated","done ill-treated"],["illuminated","done illuminated"],["illustrated","done illustrated"],["inaugurated","done inaugurated"],["recollected","done recollected"],["transferred","done transferred"],["transformed","done transformed"],["i have got","i got"],["small town","one horse town"],["wild horse","bad hoss "],["bar tender","bar dog "],["over there","over yonder"],["no worries","no trouble"],["completely","plum"],["windsheild","winsheel"],["be patient","hol' yer 'tato"],["a show off","all hat and no cattle"],["goddamn it","dad burn it"],["doesn't it","dudnit"],["everywhere","all the caboose "],["unexpected","afterclaps"],["unpleasant","all beer and skittles "],["ass kisser","boot licker"],["bad person","bad egg "],["by the way","by the by"],["distillery","bucket shop"],["full speed","lickety split "],["half grown","between hay and grass "],["lights out","douse-the-lights"],["northerner","angolmaniacs"],["open sight","above-board "],["proficient","dab"],["prostitute","abandons"],["silverware","eatin' irons"],["strong man","buster"],["vegetables","greens"],["very crazy","crazy as a loon"],["difficulty","hitch"],["compare to","holds a candle to"],["homosexual","fag"],["in trouble","in a pinch"],["bothersome","pesky"],["waste time","piddle"],["apologized","done apologized"],["approached","done approached"],["astonished","done astonished"],["beautified","done beautified"],["calculated","done calculated"],["celebrated","done celebrated"],["challenged","done challenged"],["classified","done classified"],["complained","done complained"],["considered","done considered"],["contracted","done contracted"],["contrasted","done contrasted"],["controlled","done controlled"],["counselled","done counselled"],["determined","done determined"],["diminished","done diminished"],["discovered","done discovered"],["downloaded","done downloaded"],["encouraged","done encouraged"],["encroached","done encroached"],["endangered","done endangered"],["evaporated","done evaporated"],["frightened","done frightened"],["humiliated","done humiliated"],["hypnotized","done hypnotized"],["identified","done identified"],["imperilled","done imperilled"],["implicated","done implicated"],["imprisoned","done imprisoned"],["inculcated","done inculcated"],["integrated","done integrated"],["introduced","done introduced"],["maintained","done maintained"],["multiplied","done multiplied"],["obstructed","done obstructed"],["originated","done originated"],["overflowed","done overflowed"],["prescribed","done prescribed"],["progressed","done progressed"],["prosecuted","done prosecuted"],["quarrelled","done quarrelled"],["questioned","done questioned"],["recognized","done recognized"],["restrained","done restrained"],["sacrificed","done sacrificed"],["sanctified","done sanctified"],["sanctioned","done sanctioned"],["saponified","done saponified"],["sterilized","done sterilized"],["stimulated","done stimulated"],["subscribed","done subscribed"],["subtracted","done subtracted"],["surrounded","done surrounded"],["terminated","done terminated"],["translated","done translated"],["understood","done understood"],["worshipped","done worshipped"],["side walk","banquette"],["hang over","barrel fever"],["hang-over","barrel fever"],["impudence","blather"],["surprised","acock"],["astounded","acock"],["fantastic","tootin' fantastic"],["very much","vaymuch"],["wednesday","wensdee"],["foreigner","farner"],["know that","know"],["preparing","fixin"],["have done","done"],["wasn't it","wudnit"],["doesnt it","dudnit"],["at a loss","all abroad "],["pregnancy","bay-window "],["ambushers","bushwhackers"],["ancestors","anasazi"],["big knife","arkansas toothpick "],["brand new","brand spakin' new"],["by itself","abisselfa"],["criticize","cut up"],["criticise","cut up"],["dependent","hanger-on"],["difficult","hard row to hoe"],["disappear","absquatulate"],["expert at","afly"],["fair deal","fair shake"],["filled up","chock full"],["good time","hog-killin' time "],["haphazard","a lick and a promise "],["integrity","grit"],["liking to","cotton to"],["long time","coon's age"],["mess with","fiddle"],["pessimist","croaker"],["respected","done respected"],["talkative","blatherskite"],["tough guy","curly wolf"],["very fast","greased lightning"],["worthless","no count"],["stay calm","hold your horses"],["game over","jig is up"],["let it go","let er' rip"],["walk away","make tracks"],["tampering","monkeying"],["undecided","on the fence"],["exhausted","played out"],["addressed","done addressed"],["announced","done announced"],["applauded","done applauded"],["attracted","done attracted"],["blossomed","done blossomed"],["broadcast","done broadcast"],["canvassed","done canvassed"],["collapsed","done collapsed"],["collected","done collected"],["commented","done commented"],["compelled","done compelled"],["completed","done completed"],["concluded","done concluded"],["conducted","done conducted"],["confessed","done confessed"],["connected","done connected"],["conquered","done conquered"],["consented","done consented"],["conserved","done conserved"],["consigned","done consigned"],["consisted","done consisted"],["consorted","done consorted"],["conspired","done conspired"],["construed","done construed"],["consulted","done consulted"],["contained","done contained"],["contemned","done contemned"],["contended","done contended"],["contested","done contested"],["continued","done continued"],["contrived","done contrived"],["converged","done converged"],["conversed","done conversed"],["converted","done converted"],["convicted","done convicted"],["convinced","done convinced"],["corrected","done corrected"],["corrupted","done corrupted"],["decorated","done decorated"],["decreased","done decreased"],["dedicated","done dedicated"],["described","done described"],["destroyed","done destroyed"],["developed","done developed"],["discussed","done discussed"],["disobeyed","done disobeyed"],["displayed","done displayed"],["disturbed","done disturbed"],["empowered","done empowered"],["encircled","done encircled"],["exchanged","done exchanged"],["exclaimed","done exclaimed"],["explained","done explained"],["expressed","done expressed"],["fulfilled","done fulfilled"],["glittered","done glittered"],["idealized","done idealized"],["illumined","done illumined"],["immolated","done immolated"],["impeached","done impeached"],["implanted","done implanted"],["impressed","done impressed"],["imprinted","done imprinted"],["increased","done increased"],["indicated","done indicated"],["inflected","done inflected"],["infringed","done infringed"],["inhabited","done inhabited"],["inherited","done inherited"],["initiated","done initiated"],["innovated","done innovated"],["inscribed","done inscribed"],["inspected","done inspected"],["installed","done installed"],["justified","done justified"],["magnified","done magnified"],["motivated","done motivated"],["neglected","done neglected"],["nourished","done nourished"],["oppressed","done oppressed"],["optimized","done optimized"],["organized","done organized"],["permitted","done permitted"],["persuaded","done persuaded"],["practised","done practised"],["preferred","done preferred"],["presented","done presented"],["preserved","done preserved"],["pretended","done pretended"],["prevented","done prevented"],["proceeded","done proceeded"],["qualified","done qualified"],["reflected","done reflected"],["regretted","done regretted"],["renounced","done renounced"],["requested","done requested"],["resembled","done resembled"],["sabotaged","done sabotaged"],["satirised","done satirised"],["satisfied","done satisfied"],["saturated","done saturated"],["sauntered","done sauntered"],["scarified","done scarified"],["scattered","done scattered"],["sentenced","done sentenced"],["separated","done separated"],["shattered","done shattered"],["shortened","done shortened"],["signalled","done signalled"],["signified","done signified"],["smothered","done smothered"],["solicited","done solicited"],["stretched","done stretched"],["submitted","done submitted"],["succeeded","done succeeded"],["suggested","done suggested"],["supported","done supported"],["surpassed","done surpassed"],["swallowed","done swallowed"],["travelled","done travelled"],["treasured","done treasured"],["triumphed","done triumphed"],["whispered","done whispered"],["they are","ther"],["i've got","i got"],["turn off","shut off"],["remember","'member"],["a little","jus' a lidl"],["coloured","done coloured"],["nonsense","all my eye "],["intended","allotted upon"],["bad news","bad medicine "],["confused","done confused"],["sidewalk","banquette"],["hangover","barrel fever "],["the cook","the bean master"],["kill him","bed him down "],["rudeness","blather"],["sheer up","buck up"],["defeated","acock"],["swearing","airin' the lungs"],["it isn't","'taint"],["be quiet","hesh up"],["probably","prolly"],["tomorrow","tamarr"],["thursday","therdee"],["saturday","saderdee"],["god damn","dad gum"],["about to","fixin to"],["has done","done"],["finallly","fahnaly"],["wasnt it","wudnit"],["isn't it","idnit"],["does not","dudn"],["cemetery","bone orchard "],["complain","bellyache"],["diarrhea","backdoor trots "],["lopsided","anti-goglin "],["thirteen","a baker’s dozen "],["ambushed","bushwhack"],["behavior","goings on"],["big boss","auger"],["buzz off","go boil your shirt"],["cheer up","buck up"],["creature","critter"],["entitled","by good rights"],["have not","ain't"],["lifetime","born days"],["meringue","calf slobbers"],["mischief","deviltry"],["new york","gotham"],["official","big bug "],["overheat","bake"],["panicked","choked the horn"],["perverse","cross-grained"],["revolver","cannon"],["squabble","bobbery"],["suddenly","all-standing "],["thorough","dyed in the wool"],["throw-up","airin' the paunch "],["violence","buckets of blood"],["watching","batting eyes "],["worn out","buzzard bait"],["go about","knock round"],["disclose","let on"],["very mad","mad as a hornet"],["inferior","one horse"],["turn out","pan out"],["stranger","pilgrim"],["afforded","done afforded"],["approved","done approved"],["attended","done attended"],["absorbed","done absorbed"],["accepted","done accepted"],["achieved","done achieved"],["acquired","done acquired"],["adjusted","done adjusted"],["admitted","done admitted"],["animated","done animated"],["answered","done answered"],["appeared","done appeared"],["arranged","done arranged"],["arrested","done arrested"],["asserted","done asserted"],["assorted","done assorted"],["attacked","done attacked"],["banished","done banished"],["believed","done believed"],["belonged","done belonged"],["besought","done besought"],["betrayed","done betrayed"],["breathed","done breathed"],["captured","done captured"],["caressed","done caressed"],["clutched","done clutched"],["compared","done compared"],["competed","done competed"],["confined","done confined"],["connoted","done connoted"],["consoled","done consoled"],["convened","done convened"],["conveyed","done conveyed"],["corroded","done corroded"],["crackled","done crackled"],["declared","done declared"],["depended","done depended"],["deprived","done deprived"],["detached","done detached"],["detected","done detected"],["differed","done differed"],["digested","done digested"],["directed","done directed"],["disposed","done disposed"],["educated","done educated"],["endorsed","done endorsed"],["engraved","done engraved"],["enlarged","done enlarged"],["excluded","done excluded"],["expanded","done expanded"],["expected","done expected"],["explored","done explored"],["extended","done extended"],["favoured","done favoured"],["finished","done finished"],["followed","done followed"],["forecast","done forecast"],["foretold","done foretold"],["gainsaid","done gainsaid"],["governed","done governed"],["happened","done happened"],["hindered","done hindered"],["idolized","done idolized"],["imagined","done imagined"],["imitated","done imitated"],["immersed","done immersed"],["impaired","done impaired"],["imparted","done imparted"],["impelled","done impelled"],["impended","done impended"],["impinged","done impinged"],["imploded","done imploded"],["implored","done implored"],["imported","done imported"],["improved","done improved"],["included","done included"],["indented","done indented"],["indulged","done indulged"],["infected","done infected"],["infested","done infested"],["inflamed","done inflamed"],["inflated","done inflated"],["informed","done informed"],["ingested","done ingested"],["injected","done injected"],["inquired","done inquired"],["inserted","done inserted"],["inspired","done inspired"],["insulted","done insulted"],["invented","done invented"],["listened","done listened"],["mattered","done mattered"],["measured","done measured"],["migrated","done migrated"],["modified","done modified"],["murmured","done murmured"],["notified","done notified"],["observed","done observed"],["obtained","done obtained"],["occupied","done occupied"],["occurred","done occurred"],["operated","done operated"],["overtook","done overtook"],["pacified","done pacified"],["pardoned","done pardoned"],["perished","done perished"],["polished","done polished"],["polluted","done polluted"],["pondered","done pondered"],["preached","done preached"],["prepared","done prepared"],["presided","done presided"],["produced","done produced"],["promised","done promised"],["proposed","done proposed"],["provided","done provided"],["punished","done punished"],["purified","done purified"],["realized","done realized"],["recalled","done recalled"],["received","done received"],["recurred","done recurred"],["referred","done referred"],["regarded","done regarded"],["remained","done remained"],["repaired","done repaired"],["repeated","done repeated"],["replaced","done replaced"],["reported","done reported"],["resisted","done resisted"],["resolved","done resolved"],["retained","done retained"],["returned","done returned"],["reviewed","done reviewed"],["saddened","done saddened"],["salvaged","done salvaged"],["sashayed","done sashayed"],["satiated","done satiated"],["scabbled","done scabbled"],["scorched","done scorched"],["scrawled","done scrawled"],["screamed","done screamed"],["scrubbed","done scrubbed"],["searched","done searched"],["selected","done selected"],["shivered","done shivered"],["smoothed","done smoothed"],["snatched","done snatched"],["sparkled","done sparkled"],["sprouted","done sprouted"],["squeezed","done squeezed"],["stitched","done stitched"],["strained","done strained"],["stressed","done stressed"],["suffered","done suffered"],["summoned","done summoned"],["supplied","done supplied"],["supposed","done supposed"],["surmised","done surmised"],["surveyed","done surveyed"],["survived","done survived"],["trampled","done trampled"],["trembled","done trembled"],["uprooted","done uprooted"],["vanished","done vanished"],["verified","done verified"],["violated","done violated"],["wandered","done wandered"],["welcomed","done welcomed"],["withdrew","done withdrew"],["to that","to that theyer"],["ive got","i got"],["are you","you"],["turn on","cut on"],["colours","cuhlors"],["colored","cuhlored"],["between","atwixt"],["decieve","bamboozle"],["confuse","bamboozle"],["pistols","barkin' irons"],["mexican","bean eater "],["brothel","bed-house "],["gambler","black-leg "],["brittle","brash"],["brother","bub"],["alcohol","bug juice"],["cussing","airin' the lungs "],["idiotic","addle-headed"],["shut up","button up"],["totally","plumb"],["tuesday","tewsdee"],["nothing","squat"],["foreign","farn"],["goddamn","dad gum"],["library","lie-berry"],["want to","wanna"],["used to","usta"],["prepare","fix"],["already","done"],["can not","cain't"],["has not","haden"],["strange","straynge"],["isnt it","idnit"],["doesn't","dudn"],["was not","wudn"],["all out","whole hog"],["con man","bunko artist"],["confess","acknowledge the corn "],["correct","according to hoyle"],["crooked","ajee"],["deceive","bamboozle"],["dilemma","fix"],["fastest","across lots "],["foreman","caporal"],["give up","hang it up"],["hear of","hear tell"],["hideout","ace in the hole"],["injured","done injured"],["mustang","bangtail"],["necktie","choke strap"],["officer","bull"],["pancake","flap-jack"],["passion","dander"],["plunder","acquisitive"],["profile","cut of their jib"],["run off","amputate your timber"],["stories","blarney"],["surpass","cap the climax"],["tedious","dull music"],["tobacco","tabackey"],["whiskey","liquid courage "],["willing","have a mind to"],["married","done married"],["talking","jawing"],["benefit","perk"],["longing","pinnin' (pronounced pie-nin)"],["abashed","done abashed"],["admired","done admired"],["advised","done advised"],["allowed","done allowed"],["applied","done applied"],["audited","done audited"],["avoided","done avoided"],["behaved","done behaved"],["blessed","done blessed"],["blurred","done blurred"],["blushed","done blushed"],["boarded","done boarded"],["boasted","done boasted"],["brought","done brought"],["brushed","done brushed"],["carried","done carried"],["changed","done changed"],["charged","done charged"],["chatted","done chatted"],["checked","done checked"],["cheered","done cheered"],["chipped","done chipped"],["cleaned","done cleaned"],["clicked","done clicked"],["climbed","done climbed"],["coughed","done coughed"],["counted","done counted"],["coursed","done coursed"],["covered","done covered"],["cowered","done cowered"],["cracked","done cracked"],["crashed","done crashed"],["created","done created"],["cribbed","done cribbed"],["crossed","done crossed"],["crowded","done crowded"],["crushed","done crushed"],["damaged","done damaged"],["dazzled","done dazzled"],["decayed","done decayed"],["decided","done decided"],["delayed","done delayed"],["deleted","done deleted"],["derived","done derived"],["desired","done desired"],["disused","done disused"],["divided","done divided"],["donated","done donated"],["dragged","done dragged"],["dressed","done dressed"],["drilled","done drilled"],["dropped","done dropped"],["emptied","done emptied"],["endured","done endured"],["enjoyed","done enjoyed"],["entered","done entered"],["escaped","done escaped"],["existed","done existed"],["fainted","done fainted"],["fancied","done fancied"],["ferried","done ferried"],["fetched","done fetched"],["flapped","done flapped"],["flashed","done flashed"],["floated","done floated"],["flopped","done flopped"],["forbade","done forbade"],["forgave","done forgave"],["forlore","done forlore"],["forsook","done forsook"],["founded","done founded"],["glanced","done glanced"],["googled","done googled"],["grabbed","done grabbed"],["granted","done granted"],["greeted","done greeted"],["gripped","done gripped"],["guarded","done guarded"],["guessed","done guessed"],["handled","done handled"],["hatched","done hatched"],["hurried","done hurried"],["hustled","done hustled"],["ignited","done ignited"],["ignored","done ignored"],["imbibed","done imbibed"],["immured","done immured"],["impeded","done impeded"],["implied","done implied"],["imposed","done imposed"],["incised","done incised"],["induced","done induced"],["infused","done infused"],["inhaled","done inhaled"],["insured","done insured"],["invited","done invited"],["knocked","done knocked"],["latched","done latched"],["laughed","done laughed"],["managed","done managed"],["marched","done marched"],["matched","done matched"],["mistook","done mistook"],["misused","done misused"],["moulded","done moulded"],["moulted","done moulted"],["noticed","done noticed"],["obliged","done obliged"],["offered","done offered"],["omitted","done omitted"],["ordered","done ordered"],["painted","done painted"],["partook","done partook"],["patched","done patched"],["planned","done planned"],["pleased","done pleased"],["plodded","done plodded"],["plotted","done plotted"],["plucked","done plucked"],["pointed","done pointed"],["praised","done praised"],["pressed","done pressed"],["rattled","done rattled"],["reached","done reached"],["rebuilt","done rebuilt"],["recited","done recited"],["reduced","done reduced"],["refused","done refused"],["related","done related"],["relaxed","done relaxed"],["removed","done removed"],["renewed","done renewed"],["replied","done replied"],["retched","done retched"],["retired","done retired"],["rewound","done rewound"],["saddled","done saddled"],["sallied","done sallied"],["saluted","done saluted"],["sampled","done sampled"],["savored","done savored"],["savvied","done savvied"],["scabbed","done scabbed"],["scalded","done scalded"],["scammed","done scammed"],["scanned","done scanned"],["scanted","done scanted"],["scarred","done scarred"],["scarped","done scarped"],["scatted","done scatted"],["scolded","done scolded"],["scowled","done scowled"],["screwed","done screwed"],["secured","done secured"],["severed","done severed"],["shirked","done shirked"],["shocked","done shocked"],["shouted","done shouted"],["shunned","done shunned"],["sighted","done sighted"],["skidded","done skidded"],["slammed","done slammed"],["slimmed","done slimmed"],["slipped","done slipped"],["smashed","done smashed"],["snapped","done snapped"],["sneezed","done sneezed"],["sniffed","done sniffed"],["soothed","done soothed"],["sprayed","done sprayed"],["started","done started"],["steeped","done steeped"],["stemmed","done stemmed"],["stepped","done stepped"],["stirred","done stirred"],["stooped","done stooped"],["stopped","done stopped"],["strayed","done strayed"],["strewed","done strewed"],["studied","done studied"],["swelled","done swelled"],["swotted","done swotted"],["tempted","done tempted"],["thanked","done thanked"],["thought","done thought"],["thumped","done thumped"],["touched","done touched"],["trained","done trained"],["trapped","done trapped"],["treated","done treated"],["trusted","done trusted"],["typeset","done typeset"],["uttered","done uttered"],["vomited","done vomited"],["watched","done watched"],["watered","done watered"],["waylaid","done waylaid"],["weighed","done weighed"],["whipped","done whipped"],["worried","done worried"],["yielded","done yielded"],["zincked","done zincked"],["we are","wer"],["she is","shers"],["finish","get through"],["colour","cuhlor"],["colors","cuhlors"],["pierce","pee-erse"],["waters","warters"],["always","allers"],["intend","allot upon "],["either","ary"],["butter","axle grease "],["shovel","banjo"],["hungry","peckish"],["shaved","bared "],["lowest","bedrock"],["cattle","beeves"],["killed","done killed"],["cussed","aired the lungs"],["beaten","acock"],["canned","airtight"],["stupid","mush-head"],["scared","done scared"],["coward","yellow belly"],["at all","'tall"],["bullet","lead plum"],["can of","canna"],["office","awfis"],["anyway","everhoo"],["monday","mundee"],["friday","fridee"],["sunday","sundee"],["i will","amana"],["better","beder"],["pretty","purty"],["cannot","cain't"],["hasn't","haden"],["doesnt","dudn"],["wasn't","wudn"],["is not","idn"],["docile","biddable"],["sleepy","balmy"],["yankee","blue belly "],["ambush","dry gulch"],["be off","cut stick"],["breach","brack"],["bustle","back staircase "],["church","gospel mill"],["coffee","arbuckle's"],["corpse","dead meat"],["cowboy","poke"],["dating","callin'"],["desire","hankering"],["dinner","chow"],["donuts","bear sign "],["farmer","alfalfa desperado "],["health","bacon"],["person","feller"],["simple","cut and dry"],["smutty","crocky"],["tomboy","gal-boy"],["use up","chaw up"],["weight","heft"],["friend","partner"],["pantry","keep"],["result","long and short"],["tamper","monkey"],["lawyer","mouthpiece"],["no way","nohow"],["weirdo","odd stick"],["wholly","out and out"],["doctor","doc"],["abated","done abated"],["agreed","done agreed"],["argued","done argued"],["banged","done banged"],["bashed","done bashed"],["batted","done batted"],["became","done became"],["befell","done befell"],["begged","done begged"],["beheld","done beheld"],["bereft","done bereft"],["boiled","done boiled"],["brayed","done brayed"],["buried","done buried"],["bought","done bought"],["buzzed","done buzzed"],["called","done called"],["carved","done carved"],["cashed","done cashed"],["caught","done caught"],["caused","done caused"],["ceased","done ceased"],["chased","done chased"],["chewed","done chewed"],["choked","done choked"],["closed","done closed"],["cooked","done cooked"],["cooled","done cooled"],["copied","done copied"],["craved","done craved"],["curbed","done curbed"],["curved","done curved"],["cycled","done cycled"],["damped","done damped"],["danced","done danced"],["dashed","done dashed"],["denied","done denied"],["dimmed","done dimmed"],["dipped","done dipped"],["dreamt","done dreamt"],["dumped","done dumped"],["earned","done earned"],["envied","done envied"],["erased","done erased"],["failed","done failed"],["fanned","done fanned"],["fought","done fought"],["filled","done filled"],["fished","done fished"],["fizzed","done fizzed"],["folded","done folded"],["forced","done forced"],["forgot","done forgot"],["formed","done formed"],["framed","done framed"],["gagged","done gagged"],["gained","done gained"],["gashed","done gashed"],["glowed","done glowed"],["graded","done graded"],["ground","done ground"],["guided","done guided"],["harmed","done harmed"],["healed","done healed"],["helped","done helped"],["hissed","done hissed"],["hoaxed","done hoaxed"],["hopped","done hopped"],["hugged","done hugged"],["hummed","done hummed"],["hunted","done hunted"],["hurled","done hurled"],["hushed","done hushed"],["inlaid","done inlaid"],["joined","done joined"],["jumped","done jumped"],["kicked","done kicked"],["kidded","done kidded"],["kissed","done kissed"],["landed","done landed"],["lasted","done lasted"],["leaked","done leaked"],["learnt","done learnt"],["leered","done leered"],["licked","done licked"],["lifted","done lifted"],["limped","done limped"],["looked","done looked"],["marked","done marked"],["mashed","done mashed"],["melted","done melted"],["milked","done milked"],["minded","done minded"],["misled","done misled"],["missed","done missed"],["moaned","done moaned"],["nailed","done nailed"],["napped","done napped"],["needed","done needed"],["nipped","done nipped"],["nodded","done nodded"],["nursed","done nursed"],["obeyed","done obeyed"],["offset","done offset"],["opened","done opened"],["opined","done opined"],["output","done output"],["parted","done parted"],["passed","done passed"],["pasted","done pasted"],["patted","done patted"],["paused","done paused"],["peeped","done peeped"],["phoned","done phoned"],["placed","done placed"],["played","done played"],["poured","done poured"],["pouted","done pouted"],["prayed","done prayed"],["proved","done proved"],["pulled","done pulled"],["pushed","done pushed"],["rained","done rained"],["recast","done recast"],["relied","done relied"],["remade","done remade"],["resold","done resold"],["rested","done rested"],["reused","done reused"],["roared","done roared"],["robbed","done robbed"],["rolled","done rolled"],["rotted","done rotted"],["rubbed","done rubbed"],["rushed","done rushed"],["sacked","done sacked"],["sagged","done sagged"],["salved","done salved"],["sapped","done sapped"],["sashed","done sashed"],["sassed","done sassed"],["scaled","done scaled"],["seated","done seated"],["sought","done sought"],["seemed","done seemed"],["seized","done seized"],["shaped","done shaped"],["shared","done shared"],["showed","done showed"],["shrank","done shrank"],["sipped","done sipped"],["smiled","done smiled"],["soared","done soared"],["sobbed","done sobbed"],["solved","done solved"],["sorted","done sorted"],["spoilt","done spoilt"],["spread","done spread"],["sprang","done sprang"],["stared","done stared"],["stated","done stated"],["stayed","done stayed"],["stored","done stored"],["strode","done strode"],["struck","done struck"],["strung","done strung"],["strove","done strove"],["sucked","done sucked"],["surged","done surged"],["swayed","done swayed"],["talked","done talked"],["tapped","done tapped"],["tasted","done tasted"],["taught","done taught"],["tended","done tended"],["tested","done tested"],["throve","done throve"],["thrust","done thrust"],["tossed","done tossed"],["turned","done turned"],["valued","done valued"],["varied","done varied"],["viewed","done viewed"],["walked","done walked"],["wanted","done wanted"],["warned","done warned"],["wasted","done wasted"],["wished","done wished"],["worked","done worked"],["yawned","done yawned"],["yelled","done yelled"],["zoomed","done zoomed"],["he is","'es"],["those","those theyer"],["write","wrahtes"],["these","thayse"],["color","cuhlor"],["white","waaht"],["steal","annex"],["argue","argy"],["money","actual"],["mouth","yap"],["shade","black spot"],["drunk","been in the sun "],["fight","brush"],["booze","bug juice"],["swear","air the lungs"],["swore","done swore"],["water","adam's ale "],["daisy","dayeesie"],["never","nary"],["armed","heeled"],["we've","we"],["there","thair"],["tired","done tired"],["thing","thang"],["drink","drank"],["isn't","idn"],["yours","yourn"],["snore","sno-wr"],["laugh","lay-uf"],["can't","cain't"],["think","thihnk"],["hasnt","haden"],["wasnt","wudn"],["askew","agee"],["cheat","hornswoggle"],["death","big jump"],["binge","bender"],["bring","fetch"],["broke","done broke"],["bully","bulldoze"],["chaps","armas"],["cheif","bean master"],["close","chock up"],["coins","hard moneys"],["crazy","loco"],["crowd","boodle"],["delay","dilly-dally"],["devil","dickens"],["favor","adds "],["feast","blow-out"],["heavy","bouncing"],["hurry","get the lead out"],["idiot","lunkhead"],["leave","cut a path"],["panic","choke the horn"],["penny","boston dollar"],["scalp","bark"],["shout","hollerin'"],["spurs","diggers"],["taunt","blow"],["throw","chuck"],["tipsy","fuddle"],["hello","howdy"],["fancy","high-falutin'"],["party","shin-dig"],["horse","hoss"],["train","iron horse"],["boots","justins"],["hands","meathooks"],["whore","painted lady"],["penis","pecker"],["knife","pig sticker"],["awoke","done awoke"],["abode","done abode"],["ached","done ached"],["acted","done acted"],["added","done added"],["arose","done arose"],["asked","done asked"],["began","done began"],["bound","done bound"],["bowed","done bowed"],["boxed","done boxed"],["built","done built"],["burnt","done burnt"],["burst","done burst"],["chose","done chose"],["clung","done clung"],["cooed","done cooed"],["coped","done coped"],["crept","done crept"],["cried","done cried"],["cured","done cured"],["dared","done dared"],["dealt","done dealt"],["dined","done dined"],["dived","done dived"],["drank","done drank"],["drove","done drove"],["dried","done dried"],["dwelt","done dwelt"],["faced","done faced"],["faxed","done faxed"],["found","done found"],["fixed","done fixed"],["flung","done flung"],["freed","done freed"],["froze","done froze"],["fried","done fried"],["gazed","done gazed"],["hated","done hated"],["heard","done heard"],["hewed","done hewed"],["hoped","done hoped"],["input","done input"],["knelt","done knelt"],["laded","done laded"],["leant","done leant"],["leapt","done leapt"],["liked","done liked"],["lived","done lived"],["meant","done meant"],["mewed","done mewed"],["mixed","done mixed"],["mooed","done mooed"],["moved","done moved"],["mowed","done mowed"],["noted","done noted"],["oozed","done oozed"],["opted","done opted"],["owned","done owned"],["plied","done plied"],["raced","done raced"],["redid","done redid"],["reset","done reset"],["ruled","done ruled"],["sated","done sated"],["sawed","done sawed"],["sewed","done sewed"],["shook","done shook"],["shove","done shove"],["shone","done shone"],["skied","done skied"],["slept","done slept"],["slung","done slung"],["slunk","done slunk"],["smelt","done smelt"],["smote","done smote"],["snuck","done snuck"],["sowed","done sowed"],["spoke","done spoke"],["spelt","done spelt"],["spent","done spent"],["spilt","done spilt"],["split","done split"],["stood","done stood"],["stole","done stole"],["stuck","done stuck"],["stung","done stung"],["stank","done stank"],["sweat","done sweat"],["swept","done swept"],["swung","done swung"],["taxed","done taxed"],["threw","done threw"],["treed","done treed"],["tried","done tried"],["typed","done typed"],["undid","done undid"],["upset","done upset"],["urged","done urged"],["vexed","done vexed"],["waved","done waved"],["waxed","done waxed"],["wound","done wound"],["wrung","done wrung"],["wrote","done wrote"],["i am","ahm"],["four","fowar"],["they","thay"],["farm","fahrm"],["acts","aycts"],["in a","ina"],["fits","feeyts"],["only","ownlee"],["wind","weend"],["food","bait"],["guns","barkin' irons"],["chef","bean master"],["feet","beetle-crushers"],["kill","beef"],["town","burg"],["kiss","buss"],["cuss","air the lungs"],["fast","across lots"],["dumb","addle-headed"],["fair","above-board"],["whip","whup"],["damn","dang"],["them","'em"],["gone","gawn"],["tall","tal"],["rain","ray-en"],["isnt","idn"],["ours","ourn"],["here","hair"],["just","jus'"],["fill","feel"],["feel","fill"],["hour","hour"],["poor","po-wr"],["hair","heyr"],["nice","nahce"],["very","hell-fired"],["baby","bundle of joy"],["beer","boose"],["best","bettermost"],["bold","brisk up"],["chew","chaw"],["coin","hard money"],["dead","buzzard food"],["dolt","dunderhead"],["dusk","candle-light"],["fail","come a copper"],["fake","hack"],["fool","chucklehead"],["fuck","fudge"],["girl","gal"],["gold","color"],["good","daisy"],["guts","gull"],["hell","blazes"],["liar","four-flusher"],["lost","gone up in smoke"],["many","heap"],["mean","close-fisted"],["pimp","blacksmith"],["runt","acorn calf "],["song","ditty"],["soon","directly"],["hoax","humbug"],["beat","done beat"],["face","puss"],["alit","done alit"],["bent","done bent"],["bade","done bade"],["bled","done bled"],["blew","done blew"],["bred","done bred"],["clad","done clad"],["came","done came"],["died","done died"],["drew","done drew"],["dyed","done dyed"],["eyed","done eyed"],["fell","done fell"],["fled","done fled"],["flew","done flew"],["went","done went"],["grew","done grew"],["hung","done hung"],["hove","done hove"],["held","done held"],["kept","done kept"],["knit","done knit"],["knew","done knew"],["laid","done laid"],["lent","done lent"],["lied","done lied"],["made","done made"],["owed","done owed"],["paid","done paid"],["pled","done pled"],["quit","done quit"],["read","done read"],["rent","done rent"],["rode","done rode"],["rang","done rang"],["said","done said"],["sold","done sold"],["sent","done sent"],["shed","done shed"],["shod","done shod"],["shut","done shut"],["sang","done sang"],["sank","done sank"],["slew","done slew"],["slid","done slid"],["sped","done sped"],["spun","done spun"],["spat","done spat"],["swam","done swam"],["took","done took"],["tore","done tore"],["teed","done teed"],["told","done told"],["tied","done tied"],["trod","done trod"],["used","done used"],["vied","done vied"],["woke","done woke"],["wore","done wore"],["wove","done wove"],["wept","done wept"],["rid","shed"],["act","ayct"],["you","ya"],["and","an"],["fit","feeyt"],["red","ree-ehd"],["oil","arl"],["hen","biddy"],["boy","button"],["are","ahr"],["top","tawp"],["him","'im"],["sad","saaid"],["shh","hesh up"],["got","gawt"],["old","ole"],["off","awk"],["get","git"],["air","ahr"],["pen","peyun"],["can","kay-yun"],["eye","ah"],["the","thuh"],["why","hooaah"],["ill","in a bad way"],["did","done"],["ice","ahce"],["bum","barrel boarder "],["die","cash in"],["eat","chew"],["gun","equalizer"],["rum","rot gut"],["run","cut dirt"],["gay","faggot"],["odd","queer"],["bra","over the shoulder bolder holder"],["bet","done bet"],["dug","done dug"],["ate","done ate"],["fed","done fed"],["had","done had"],["hid","done hid"],["led","done led"],["let","done let"],["lay","done lay"],["met","done met"],["put","done put"],["rid","done rid"],["ran","done ran"],["saw","done saw"],["set","done set"],["sat","done sat"],["wed","done wed"],["wet","done wet"],["won","done won"],["if","ifin'"],["to","t'"],["on","awn"],["of","awf"],["tv","tee-vee"],["my","maah"],["he","'e"],["up","uhp"],["go","gitty-up"],["i","ah"]]}
			},
			{
				name: "australian",
				type: "translate",
				aliases: ["KKrikey", "outback"],
				data: { "phrasesWords":[["everything will be all right","shee'll be right"],["don't worry about it","she'll be right"],["cabernet sauvignon","cab sav"],["middle of nowhere","woop woop"],["environmentalist","greenie"],["congratulations","good onya"],["passing through","shooting through"],["lost their cool","spat the dummy"],["tracksuit pants","trackie dacks"],["administrative","fahkin' administrative"],["slot machines","pokies"],["environmental","fahkin' environmental"],["psychological","fahkin' psychological"],["comprehensive","fahkin' comprehensive"],["the real deal","true blue"],["give it a try","give it a burl"],["see you later","hooroo"],["lost his cool","spat the dummy"],["lost her cool","spat the dummy"],["lost its cool","spat the dummy"],["baby kangaroo","joey"],["pick up truck","ute"],["queenslander","banana bender"],["bell peppers","capsicums"],["lemon squash","lemonade"],["nymphomaniac","root rat"],["compensation","comp"],["cotton candy","fairy floss"],["give it a go","give it a whirl"],["young surfer","grommet"],["truck driver","truckie"],["pickup truck","ute"],["lazy person","bludger"],["bell pepper","capsicum"],["outstanding","grouse"],["criticising","knocking"],["criticizing","knocking"],["complaining","whinging"],["truckdriver","truckie"],["electrician","sparkie"],["beer bottle","stubby"],["chewing gum","chewie"],["documentary","doco"],["candy floss","fairy floss"],["politicians","pollies"],["traditional","fahkin' traditional"],["significant","fahkin' significant"],["intelligent","fahkin' intelligent"],["interesting","fahkin' interesting"],["responsible","fahkin' responsible"],["competitive","fahkin' competitive"],["educational","fahkin' educational"],["embarrassed","fahkin' embarrassed"],["substantial","fahkin' substantial"],["seeya later","hooroo"],["what do you","wadaya"],["how did you","howdya"],["bottle shop","bottle-o"],["gas station","servo"],["brick layer","brickie"],["sun glasses","sunnies"],["can of beet","tinny"],["binge drink","hit the turps"],["australian","strine"],["tremendous","grouse"],["journalist","journo"],["criticised","knocked"],["criticized","knocked"],["complained","whinged"],["bricklayer","brickie"],["definitely","defo"],["devastated","devo"],["sunglasses","sunnies"],["mcdonald's","maccas"],["cheap wine","plonk"],["politician","polly"],["university","uni"],["vegetables","veggies"],["volkswagon","vee dub"],["vegetarian","veggo"],["historical","fahkin' historical"],["additional","fahkin' additional"],["successful","fahkin' successful"],["electrical","fahkin' electrical"],["impossible","fahkin' impossible"],["electronic","fahkin' electronic"],["sufficient","fahkin' sufficient"],["consistent","fahkin' consistent"],["acceptable","fahkin' acceptable"],["aggressive","fahkin' aggressive"],["reasonable","fahkin' reasonable"],["impressive","fahkin' impressive"],["remarkable","fahkin' remarkable"],["suspicious","fahkin' suspicious"],["try it out","give it a burl"],["how do you","howdya"],["cry babies","sooks"],["no problem","no dramas"],["no problem","no worries"],["having sex","rooting"],["afternoon","arvo"],["excellent","bonza"],["excellent","grouse"],["criticise","knock"],["criticize","knock"],["assistant","offsider"],["crybabies","sooks"],["swim suit","togs"],["tradesman","tradie"],["carpenter","chippie"],["breakfast","brekky"],["chocolate","choccy"],["cigarette","ciggy"],["policeman","copper"],["policemen","coppers"],["cigarette","durry"],["prankster","larrakin"],["mcdonalds","maccas"],["relatives","rellies"],["ambulance","ambo"],["surprised","gobsmacked"],["astounded","gobsmacked"],["underwear","grundies"],["fantastic","rip-snorter"],["apartment","unit"],["different","fahkin' different"],["important","fahkin' important"],["difficult","fahkin' difficult"],["emotional","fahkin' emotional"],["political","fahkin' political"],["financial","fahkin' financial"],["expensive","fahkin' expensive"],["wonderful","fahkin' wonderful"],["technical","fahkin' technical"],["immediate","fahkin' immediate"],["dangerous","fahkin' dangerous"],["efficient","fahkin' efficient"],["practical","fahkin' practical"],["automatic","fahkin' automatic"],["desperate","fahkin' desperate"],["realistic","fahkin' realistic"],["confident","fahkin' confident"],["conscious","fahkin' conscious"],["have a go","avago"],["swim suit","togs"],["thank you","ta"],["dick head","mongrel"],["it's okay","no worries"],["went away","pissed off"],["barbecue","barbie"],["layabout","bludger"],["soldiers","diggers"],["complain","grizzle"],["popsicle","icy pole"],["yourself","self"],["sausages","snags"],["pacifier","dummy"],["pacifier","dummies"],["complain","whinge"],["kangaroo","roo"],["thankyou","ta"],["umbrella","brolly"],["chistmas","chrissy"],["trousers","daks"],["facebook","facey"],["honestly","fair dinkum"],["football","soccer"],["hooligan","hoon"],["dickhead","mongrel"],["mosquito","mozzie"],["relative","rellie"],["erection","stiffy"],["you guys","youse"],["blow fly","blowie"],["erection","fat one"],["kerosene","kero"],["position","pozzy"],["sandwich","sanger"],["g-string","bum floss"],["pregnant","fahkin' pregnant"],["critical","fahkin' critical"],["relevant","fahkin' relevant"],["accurate","fahkin' accurate"],["dramatic","fahkin' dramatic"],["powerful","fahkin' powerful"],["suitable","fahkin' suitable"],["numerous","fahkin' numerous"],["cultural","fahkin' cultural"],["existing","fahkin' existing"],["distinct","fahkin' distinct"],["southern","fahkin' southern"],["exciting","fahkin' exciting"],["friendly","fahkin' friendly"],["unlikely","fahkin' unlikely"],["informal","fahkin' informal"],["pleasant","fahkin' pleasant"],["terrible","fahkin' terrible"],["good day","g'day"],["cry baby","sook"],["have sex","have a naughty"],["fuck off","nick off"],["days off","sickies"],["sick day","sickie"],["its okay","no worries"],["get lost","piss off"],["fuck off","rack off"],["beer can","tinny"],["avacado","avo"],["alcohol","liquor"],["farmers","cockies"],["soldier","digger"],["engines","donks"],["awesome","grouse"],["slander","rubbish"],["genuine","ridgy-didge"],["genuine","fair dinkum"],["awesome","ripper"],["crybaby","sook"],["sausage","snag"],["bastard","rat bag"],["redneck","bogan"],["awesome","sweet as"],["speedos","budgie smugglers"],["biscuit","biccy"],["chicken","chook"],["lollies","sweets"],["runners","sneakers"],["pleased","stoked"],["chicken","chook"],["receipt","docket"],["tobacco","durry"],["alcohol","piss"],["goodbye","hooroo"],["refused","knocked back"],["parents","oldies"],["postman","postie"],["present","prezzy"],["pleased","stoked"],["sandals","thongs"],["popular","fahkin' popular"],["various","fahkin' various"],["several","fahkin' several"],["similar","fahkin' similar"],["healthy","fahkin' healthy"],["medical","fahkin' medical"],["federal","fahkin' federal"],["helpful","fahkin' helpful"],["willing","fahkin' willing"],["serious","fahkin' serious"],["typical","fahkin' typical"],["capable","fahkin' capable"],["foreign","fahkin' foreign"],["unusual","fahkin' unusual"],["obvious","fahkin' obvious"],["careful","fahkin' careful"],["unhappy","fahkin' unhappy"],["eastern","fahkin' eastern"],["logical","fahkin' logical"],["massive","fahkin' massive"],["visible","fahkin' visible"],["anxious","fahkin' anxious"],["curious","fahkin' curious"],["nervous","fahkin' nervous"],["day off","sickie"],["tea pot","billy"],["are you","you"],["go away","piss off"],["went to","pissed off to"],["i think","i reckon"],["a smoke","a ciggy"],["friend","mate"],["farmer","cockie"],["losers","dags"],["idiots","ding bats"],["icebox","esky"],["engine","donk"],["wicked","ripper"],["honest","true blue"],["idiots","wallies"],["toilet","dunny"],["thanks","ta"],["cancel","bail"],["teapot","billy"],["broken","cactus"],["police","cops"],["honest","fair dinkum"],["laptop","lappy"],["dinner","tea"],["friend","cobber"],["condom","franger"],["liquor","grog"],["undies","grundies"],["refuse","knock back"],["father","old fella"],["mother","old lady"],["dollar","quid"],["coward","wuss"],["forest","bush"],["united","fahkin' united"],["useful","fahkin' useful"],["mental","fahkin' mental"],["scared","fahkin' scared"],["entire","fahkin' entire"],["strong","fahkin' strong"],["actual","fahkin' actual"],["recent","fahkin' recent"],["global","fahkin' global"],["hungry","fahkin' hungry"],["severe","fahkin' severe"],["famous","fahkin' famous"],["afraid","fahkin' afraid"],["latter","fahkin' latter"],["boring","fahkin' boring"],["strict","fahkin' strict"],["former","fahkin' former"],["unfair","fahkin' unfair"],["sexual","fahkin' sexual"],["sudden","fahkin' sudden"],["unable","fahkin' unable"],["wooden","fahkin' wooden"],["asleep","fahkin' asleep"],["decent","fahkin' decent"],["guilty","fahkin' guilty"],["lonely","fahkin' lonely"],["go and","garn"],["laters","hooroo"],["do you","dya"],["set up","tee up"],["truth","fair dinkum"],["aaron","azza"],["party","bash"],["great","bonza"],["woman","sheila"],["women","sheilas"],["chick","sheila"],["loser","dag"],["goofs","dags"],["nerds","dags"],["fools","ding bats"],["fools","donks"],["idiot","ding bat"],["brave","game"],["hello","g'day"],["kudos","good onya"],["loser","no-hoper"],["going","garn"],["wimps","sooks"],["idiot","wally"],["prude","wowser"],["talks","yabber"],["tired","knackered"],["mouth","gob"],["messy","grubby"],["hello","g'day"],["loads","heaps"],["risky","iffy"],["clown","larrakin"],["drunk","legless"],["linen","manchester"],["naked","nuddy"],["tired","rooted"],["happy","stoked"],["tired","stuffed"],["y'all","youse"],["bored","bored shitless"],["vomit","chunder"],["idiot","dipstick"],["penis","doodle"],["booze","grog"],["sheep","jumbuck"],["hater","knocker"],["penis","old fella"],["wives","old ladies"],["drunk","rotten"],["boast","skite"],["fight","scrap"],["trash","rubbish"],["large","fahkin' large"],["known","fahkin' known"],["happy","fahkin' happy"],["aware","fahkin' aware"],["legal","fahkin' legal"],["civil","fahkin' civil"],["alive","fahkin' alive"],["angry","fahkin' angry"],["lucky","fahkin' lucky"],["sorry","fahkin' sorry"],["inner","fahkin' inner"],["true","fair dinkum"],["have","av"],["sick","crook"],["goof","dag"],["nerd","dag"],["fool","ding bat"],["fool","donk"],["good","good as gold"],["good","bloody good"],["yeah","yer"],["brit","pom"],["wimp","sook"],["food","tucker"],["chav","yobbo"],["dude","cobber"],["wife","misses"],["full","chockers"],["fuck","root"],["beer","cold one"],["acdc","accadacca"],["pond","billabong"],["dead","cactus"],["full","choc a bloc"],["beer","coldie"],["sick","crook"],["mate","cunt"],["geek","dag"],["cool","dardy"],["true","deadset"],["fool","drongo"],["busy","flat out"],["beer","frothy"],["wine","goon"],["lots","heaps"],["city","big smoke"],["died","carked it"],["fool","fruit loop"],["beer","piss"],["wife","old lady"],["brag","skite"],["hobo","swagman"],["flat","unit"],["loud","howlin'"],["poor","fahkin' poor"],["cute","fahkin' cute"],["nice","fahkin' nice"],["huge","fahkin' huge"],["rare","fahkin' rare"],["pure","fahkin' pure"],["ugly","fahkin' ugly"],["weak","fahkin' weak"],["tall","fahkin' tall"],["tiny","fahkin' tiny"],["bbq","barbie"],["man","bloke"],["guy","bloke"],["men","blokes"],["put","bung"],["cry","sook"],["gas","petrol"],["yes","bloody oath"],["ill","crook"],["you","ya"],["pub","boozer"],["afl","footy"],["lie","porkie"],["tea","supper"],["and","'n"],["the","the fuckin'"],["the","the bloody"],["cop","coppa"],["old","ol'"],["hot","fahkin' hot"],["old","fahkin' old"],["mad","fahkin' mad"],["odd","fahkin' odd"],["hi","g'day"],["to","ta"],["",""],["",""],["",""],["",""]],"suffixes":[["tting","ding"],["alia","aya"],["ting","ding"],["day","dee"],["ing","in'"],["ike","iyyke"],["ate","ayyte"],["ter","der"],["oar","aw"],["ure","ah"],["our","ah"],["old","ol'"],["ase","ayse"],["ty","dy"],["er","ah"],["or","ah"],["ar","ah"],["re","ah"],["a","ah"]],"prefixes":[["tues","choos"],["aus","'s"],["are","ah"],["jew","dew"],["ha","'a"],["wh","w"]],"intrawords":[["ain","ayyn"],["amp","ehmp"],["ape","aype"],["mer","mah"],["or","awr"],["ar","ahr"],["ty","choo"]],"endings":["Fahkin' fair dinkum mate.","Fair dinkum mate.","Bloody oath mate.","Fahkin' bloody oath mate.","Fahkin' too right, mate.","Too right, mate.","Fahkin' fair dinkum cobber.","Fair dinkum cobber.","Bloody oath cobber.","Fahkin' bloody oath cobber.","Fahkin' too right, cobber.","Too right, cobber."]}
			},
			{
				name: "capitalize",
				type: "method",
				aliases: ["cap"],
				data: (message) => message.split(" ").map(i => sb.Utils.capitalize(i)).join(" ")
			},
			{
				name: "lowercase",
				type: "method",
				aliases: ["lc", "lower"],
				data: (message) => message.toLowerCase()
			},
			{
				name: "uppercase",
				type: "method",
				aliases: ["uc", "upper"],
				data: (message) => message.toUpperCase()
			},
			{
				name: "monkaOMEGA",
				type: "method",
				aliases: [],
				description: "Replaces every \"o\" and \"0\" with the monkaOMEGA emote",
				data: (message) => message.replace(/[oOｏＯоО]/g, " monkaOMEGA ")
			},
			{
				name: "OMEGALUL",
				type: "method",
				aliases: [],
				description: "Replaces every \"o\" and \"0\" with the OMEGALUL emote",
				data: (message) => message.replace(/[oOｏＯоО]/g, " OMEGALUL ")
			},
			{
				name: "owoify",
				type: "method",
				aliases: ["owo"],
				data: (message) => message.replace(/(?:[rl])/g, "w")
					.replace(/(?:[RL])/g, "W")
					.replace(/n([aeiou])/g, "ny$1")
					.replace(/N([aeiou])/g, "Ny$1")
					.replace(/N([AEIOU])/g, "Ny$1")
					.replace(/ove/g, "uv")
					.replace(/[!?]+/g, ` ${sb.Utils.randArray(["(・`ω´・)", ";;w;;", "owo", "UwU", ">w<", "^w^"])} `)
			},
			{

				name: "reverse",
				type: "method",
				aliases: [],
				data: (message) => Array.from(message)
					.reverse()
					.join("")
					.replace(/[()]/g, (char) => (char === ")") ? "(" : ")")
			},
			{
				name: "random",
				type: "method",
				aliases: [],
				description: "Picks a random different text transform and applies it",
				data: (message) => {
					const random = sb.Utils.randArray(types.filter(i => i.name !== "random"));
					return convert[random.type](message, random.data);
				}
			},
			{
				name: "antiping",
				type: "method",
				aliases: [],
				description: "Every word will have an invisible character added, so that it does not mention users in e.g. Chatterino.",
				data: (message) => message.split(" ").map(word => {
					if (/^\w+$/.test(word)) {
						return `${word[0]}\u{E0000}${word.slice(1)}`;
					}
					else {
						return word;
					}
				}).join(" "),
				reverseData: (message) => message.split(" ").map(word => {
					if (!/^.\u{E0000}/u.test(word)) {
						return word;
					}

					const arr = Array.from(word);
					return arr[0] + arr.slice(2).join("");
				}).join(" ")
			},
			{
				name: "trim",
				type: "method",
				aliases: [],
				description: "Removes all whitespace from the message - spaces, tabs, newlines and so on.",
				data: (message) => message.replace(/\s+/g, "")
			},
			{
				name: "binary",
				type: "method",
				aliases: ["bin"],
				data: (message) => message.split("").map(i => ("0".repeat(8) + i.charCodeAt(0).toString(2)).slice(-8)).join(" ")
			},
			{
				name: "morse",
				type: "method",
				aliases: [],
				data: (message) => {
					const arr = [];
					for (const character of message.toLowerCase()) {
						if (character === " ") {
							arr.push("/");
						}
						else if (morse[character]) {
							arr.push(morse[character]);
						}
					}

					return arr.join(" ");
				}
			},
			{
				name: "box",
				type: "method",
				aliases: ["boxes"],
				description: "Attempts to wrap letters in a box-like thing. Might not work with all fonts.",
				data: (message) => {
					const arr = [];
					const combine = String.fromCharCode(0xFE0F);
					const box = String.fromCharCode(0x20E3);

					for (const character of message) {
						if (character === " ") {
							arr.push(character);
						}
						else {
							arr.push(character, box, combine);
						}
					}

					return arr.join("");
				}
			},
			{
				name: "spongebob",
				type: "method",
				aliases: ["mock", "mocking", "spongemock"],
				description: "Randomly capitalizes and lowercases characters in the message to make it look as if mocking someone.",
				data: (message) => Array.from(message).map(char => {
					if (/[a-zA-Z]/.test(char)) {
						return sb.Utils.random(0, 1) ? char.toUpperCase() : char.toLowerCase();
					}
					else {
						return char;
					}
				}).join("")
			},
			{
				name: "typoglycemia",
				type: "method",
				aliases: ["tg", "jumble"],
				description: "Shuffles a message to make it typoglycemic. This means that every word with 4+ characters will have all of its letters shuffled, except the first and last one.",
				data: (message) => {
					const result = [];
					for (const word of message.split(/\b/)) {
						const stripped = sb.Utils.removeAccents(word);
						if (/[^a-z]/i.test(stripped)) {
							result.push(word);
							continue;
						}

						const scrambled = [];
						const chars = word.slice(1, -1).split("");
						while (chars.length > 0) {
							const randomIndex = sb.Utils.random(0, chars.length - 1);
							scrambled.push(chars[randomIndex]);
							chars.splice(randomIndex, 1);
						}

						result.push(`${word[0]}${scrambled.join("")}${word[word.length - 1]}`);
					}

					return result.join("");
				}
			},
			{
				name: "official",
				type: "method",
				aliases: [],
				description: "Replaces your text with \"mathematical\" symbols - also used in attempts to recreate the Twitter \"official sources say\" message.",
				data: (string) => {
					const result = convert.map(string, officialCharactersMap);
					return `ⓘ ${result}`;
				},
				reverseData: (string) => {
					const output = string.replace(/ⓘ/g, "");
					return convert.unmap(output, officialCharactersMap);
				}
			}
		];
		/* eslint-enable quote-props, key-spacing, object-property-newline */

		return {
			convert,
			types
		};
	}),
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

		const message = args.join(" ");
		const transformation = this.staticData.types.find(i => (
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

		const result = this.staticData.convert[type](message, data);
		if (!result) {
			return {
				success: false,
				reply: "No result has been created?!"
			};
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
	Dynamic_Description: (async (prefix, values) => {
		const lorem = "Lorem Ipsum is simply dummy text of the printing and typesetting industry.";
		const { types, convert } = values.getStaticData();
		const examples = types.sort((a, b) => a.name.localeCompare(b.name)).map(transform => {
			const description = transform.description ?? "(no description)";
			const message = convert[transform.type](lorem, transform.data ?? null);
			const aliases = (transform.aliases.length === 0)
				? ""
				: ` (${transform.aliases.join(", ")})`;

			return sb.Utils.tag.trim `
				<li>
					<code>${transform.name}${aliases}</code>
					<ul>
						<li>Reversible: ${transform.type === "map" ? "Yes" : "No"}</li>
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

			`Note: if used within the <a href="/bot/command/104">pipe command</a>, this command has no cooldown, and you can use it multiple times within the same pipe!`,
			"",

			`Example text: ${lorem}`,
			"",

			`<ul>${examples.join("<br>")}</ul>`
		];
	})
};
