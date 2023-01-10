module.exports = {
	name: "price",
	title: "Item prices",
	aliases: [],
	description: [
		`<code>$osrs price (item)</code>`,
		`Posts the item's current GE price, along with trends. The most popular items also respond to aliases.`
	],
	execute: async function (context, ...args) {
		const alias = await sb.Query.getRecordset(rs => rs
			.select("Name")
			.from("osrs", "Item")
			.where(`JSON_SEARCH(Aliases, "one", %s) IS NOT NULL`, args.join(" ").toLowerCase())
			.single()
			.limit(1)
			.flat("Name")
		);

		const query = (alias ?? args.join(" ")).toLowerCase();
		const data = await sb.Query.getRecordset(rs => {
			rs.select("Game_ID", "Name", "Value")
				.from("osrs", "Item");

			for (const word of query.split(" ")) {
				rs.where("Name %*like*", word);
			}

			return rs;
		});

		if (data.length === 0) {
			return {
				success: false,
				reply: `No items found for given query!`
			};
		}

		const bestMatch = sb.Utils.selectClosestString(query, data.map(i => i.Name), { ignoreCase: true });
		const item = (bestMatch !== null)
			? data.find(i => i.Name.toLowerCase() === bestMatch.toLowerCase())
			: data[0];

		if (!item) {
			return {
				success: false,
				reply: "Could not match item!"
			};
		}

		const response = await sb.Got("GenericAPI", {
			url: "https://prices.runescape.wiki/api/v1/osrs/latest",
			throwHttpErrors: false,
			searchParams: {
				id: item.Game_ID
			}
		});

		if (response.statusCode !== 200) {
			return {
				success: false,
				reply: `Item not found!`
			};
		}

		const formatPrice = (price) => {
			if (price < 1000) {
				return price;
			}
			else {
				return sb.Utils.formatSI(price, "", 3, true).replace("G", "B");
			}
		};

		const itemData = response.body.data[item.Game_ID];
		const { low, high } = itemData;
		const priceString = (low === high)
			? `${formatPrice(low)} gp`
			: `${formatPrice(low)} gp - ${formatPrice(high)} gp`;

		// const lowDelta = sb.Utils.timeDelta(new sb.Date(itemData.lowTime * 1000));
		// const highDelta = sb.Utils.timeDelta(new sb.Date(itemData.highTime * 1000));

		const highAlchValue = formatPrice(Math.floor(item.Value * 0.6));
		const wiki = `https://prices.runescape.wiki/osrs/item/${item.Game_ID}`;
		return {
			reply: sb.Utils.tag.trim `
					Current price range of ${item.Name}: ${priceString};
					HA value: ${highAlchValue} gp
					${wiki}
				`
		};
	}
};
