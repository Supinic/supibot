/* eslint-disable max-nested-callbacks */
/* global describe, it */
const assert = require("assert");

globalThis.sb = {
	Date: require("../../../objects/date"),
	Utils: {
		parseRegExp: (input) => new RegExp(input)
	}
};

const Command = require("../../../classes/command");
const paramsDefinition = [
	{ name: "boolean", type: "boolean" },
	{ name: "date", type: "date" },
	{ name: "number", type: "number" },
	{ name: "object", type: "object" },
	{ name: "regex", type: "regex" },
	{ name: "string", type: "string" }
];
const sampleStringValues = {
	boolean: "true",
	date: "2022-04-01",
	number: "123",
	object: "foo=bar",
	string: "foo",
	regex: "/foobar/i"
};

describe("Command.parseParametersFromArgs", () => {
	it("return no arguments for empty input", () => {
		const result = Command.parseParametersFromArguments(paramsDefinition, []);

		assert.notStrictEqual(result.success, false, `Param parsing must not fail: ${JSON.stringify(result)}`);
		assert.strictEqual(Object.keys(result.parameters).length, 0, "Resulting params must be an empty object");
		assert.strictEqual(result.args.length, 0, "Remaining args must be an empty array");
	});

	it("return a correctly typed single argument", () => {
		for (const delimiter of ["", "\""]) {
			for (const { name, type } of paramsDefinition) {
				const result = Command.parseParametersFromArguments(
					paramsDefinition,
					[`${name}:${delimiter}${sampleStringValues[type]}${delimiter}`]
				);

				assert.notStrictEqual(result.success, false, `Param parsing must not fail: ${JSON.stringify(result)}`);
				assert.strictEqual(Object.keys(result.parameters).length, 1, "Exactly one param must be extracted");
				assert.strictEqual(result.args.length, 0, "Remaining args must be an empty array");

				const param = result.parameters[name];
				assert.notStrictEqual(param, undefined, "Parsed param must not be undefined");

				if (type === "regex") {
					assert.strictEqual(param instanceof RegExp, true, "Regex-type param must be instanceof RegExp");
				}
				else if (type === "date") {
					assert.strictEqual(param instanceof sb.Date, true, "Date-type param must be instanceof sb.Date");
				}
				else if (type === "object") {
					assert.strictEqual(param instanceof Object, true, "Object-type param must be instanceof Object");
				}
				else {
					assert.strictEqual(typeof param, type, `${type}-type param must be of the correct type`);
				}
			}
		}
	});

	it("return a correctly typed single argument and remaining non-param args", () => {
		const remaining = ["a", "b", "c"];
		const result = Command.parseParametersFromArguments(
			paramsDefinition,
			["string:foobar", ...remaining]
		);

		assert.notStrictEqual(result.success, false, `Param parsing must not fail: ${JSON.stringify(result)}`);
		assert.strictEqual(Object.keys(result.parameters).length, 1, "Exactly one param must be extracted");

		assert.strictEqual(result.args.length, remaining.length, "Remaining args must be correct length");
		assert.deepStrictEqual(result.args, remaining, "Remaining args must be correctly ordered and equal");
	});

	it("overrides a duplicate parameter", () => {
		return it.skip("Currently not functional");

		// const result = Command.parseParametersFromArguments(
		// 	paramsDefinition,
		// 	["string:foobar", "string:barbaz"]
		// );
		//
		// assert.notStrictEqual(result.success, false, `Param parsing must not fail: ${JSON.stringify(result)}`);
		// assert.strictEqual(Object.keys(result.parameters).length, 1, "Exactly one param must be extracted");
		// assert.strictEqual(result.args.length, 0, "Remaining args should be empty");
		//
		// assert.strictEqual(result.parameters.string, "barbaz", "Extracted param should have the correct overriden value");
	});
});
