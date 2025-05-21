const url = "https://www.worldometers.info/coronavirus";

export default async () => {
	let response = null;
	try {
		response = await core.Got.get("FakeAgent")({
			url,
			responseType: "text"
		});
	}
	catch {
		return {
			success: false
		};
	}

	const $ = core.Utils.cheerio(response.body);
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
