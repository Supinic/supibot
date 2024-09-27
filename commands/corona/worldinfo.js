const url = "https://www.worldometers.info/coronavirus";

module.exports = async () => {
	let response = null;
	try {
		response = await sb.Got.get("FakeAgent")({
			url,
			responseType: "text"
		});
	}
	catch (e) {
		return {
			success: false
		};
	}

	const $ = sb.Utils.cheerio(response.body);
	const nodes = $(".maincounter-number span");
	const [total, deaths, recoveries] = [...nodes].map(i => {
		const textNode = i.children[0].data;
		return Number(textNode.trim().replaceAll(",", ""));
	});

	return {
		success: true,
		total,
		deaths,
		recoveries
	};
};
