/* global sb */
(async function () {
	require("/code/keys/load-keys.js")();
	await require("../index.js");

	try {
		let rowx = await sb.query.Row("chat_data.Channel");
		await rowx.load(1);
		console.log(rowx._values);

		console.log(await sb.query.raw("SELECT * FROM chat_data.Channel WHERE ID = 1"));

		let row = await sb.query.Row("test.Test_With_ID");
		row.setValues({
			Timestamp: new sb.Date(864e8),
		});

		await row.save();
		console.log("Row with PK insert - success");

		await row.load(1);
		console.log("Row with PK load - success");

		row.setValues({
			Timestamp: new sb.Date(864e10)
		});
		await row.save();
		console.log("Row with PK update - success");

		try {
			await row.load(2);
			await row.delete();
			console.log("Row with PK delete - success");
		}
		catch (e) {
			console.log("Row ID=2 does not exist");
		}

		console.log("-".repeat(50));

		row = await sb.query.Row("test.Test_Without_ID");
		row.setValues({
			Main_Key: new sb.Date(sb.Utils.rand(1e7, 1e11)),
			Text: "just get it working looool 4HEad"
		});

		await row.save();
		console.log("Row with Date PK insert - success");

		await row.load(new sb.Date("2018-11-29 16:52:08"));
		console.log("Row with Date PK load - success");

		row.setValues({
			Text: Math.random().toString()
		});

		await row.save();
		console.log("Row with Date PK update - success");

		console.log("-".repeat(50));

		let rs = await sb.query.Recordset(rs => rs
			.select("*")
			.from("test.Test_With_ID")
		);

		console.log("Simple RS with PK - success", rs.length);

	}
	catch (e) {
		console.log("ERROR!", e.name, e.stack, e.args);
	}

})();