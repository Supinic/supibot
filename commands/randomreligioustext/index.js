module.exports = {
	Name: "randomreligioustext",
	Aliases: ["rrt"],
	Author: "supinic",
	Cooldown: 10000,
	Description: "Fetches a random religious text from both the Bible and the Quran, then mashes them together for artistic effect.",
	Flags: ["mention","non-nullable","pipe"],
	Params: null,
	Whitelist_Response: null,
	Static_Data: (() => ({
		surahVerses: [
			7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6
		]
	})),
	Code: (async function randomReligiousText (context) {
		const surahNumber = sb.Utils.random(1, this.staticData.surahVerses.length);
		const surahVerse = sb.Utils.random(1, this.staticData.surahVerses[surahNumber - 1]);
	
		const [bibleData, surahData] = await Promise.all([
			sb.Got("https://labs.bible.org/api/?passage=random&type=json").json(),
			sb.Got(`https://api.quran.sutanlab.id/surah/${surahNumber}/${surahVerse}`).json()
		]);
	
		const bibleText = bibleData[0].text.split(/\W/).filter(Boolean);
		const surahText = surahData.data.translation.en.replace(/\[.*?]/g, "").split(/\W/).filter(Boolean);
	
		const shuffle = sb.Command.get("shuffle");
		const result = await shuffle.execute(context, ...[...bibleText, ...surahText]);	
		// for (let i = 0; i < bibleText.length; i++) {
		// 	result.push(bibleText[i]);
		//
		// 	if (surahText[i]) {
		// 		result.push(surahText[i]);
		// 	}
		// 	else {
		// 		break;
		// 	}
		// }
	
		const { bookname, chapter, verse } = bibleData[0];
		const surahName = surahData.data.surah.name.translation.id;
	
		const key = `${bookname} ${chapter}:${verse} + ${surahName} ${surahNumber}:${surahVerse}`;
		const reply = sb.Utils.capitalize(result.reply.toLowerCase());
	
		return {
			reply: `${key} - ${reply}.`
		};
	}),
	Dynamic_Description: null
};