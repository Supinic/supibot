const assert = require("assert");
const Command = require("../../../classes/command");

beforeEach(() => {
	globalThis.sb = {
		Date: require("../../../objects/date"),
		Utils: {
			parseRegExp: (input) => {
				try {
					return new RegExp(input);
				}
				catch {
					return null;
				}
			}
		}
	};
});

describe("Command parameter parsing", () => {
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

	const checkParameterType = (value, type) => {
		assert.notStrictEqual(value, undefined, "Parsed param must not be undefined");

		if (type === "regex") {
			assert.strictEqual(value instanceof RegExp, true, "Regex-type param must be instanceof RegExp");
		}
		else if (type === "date") {
			assert.strictEqual(value instanceof sb.Date, true, "Date-type param must be instanceof sb.Date");
		}
		else if (type === "object") {
			assert.strictEqual(value instanceof Object, true, "Object-type param must be instanceof Object");
		}
		else {
			assert.strictEqual(typeof value, type, `${type}-type param must be of the correct type`);
		}
	};


	it("returns no arguments for empty input", () => {
		const result = Command.parseParametersFromArguments(paramsDefinition, []);

		assert.strictEqual(result.success, true, `Param parsing must not fail: ${JSON.stringify(result)}`);
		assert.strictEqual(Object.keys(result.parameters).length, 0, "Resulting params must be an empty object");
		assert.strictEqual(result.args.length, 0, "Remaining args must be an empty array");
	});

	describe("invalid parameters definition", () => {
		const nonStringTypes = Object.keys(sampleStringValues).filter(i => i !== "string");

		it("fails for empty implicit string param", () => {
			const result = Command.parseParametersFromArguments(
				paramsDefinition,
				["string:"]
			);

			assert.strictEqual(result.success, false, `Param parsing must fail: ${JSON.stringify(result)}`);
		});

		it("fails for empty implicit non-string param", () => {
			for (const type of nonStringTypes) {
				const result = Command.parseParametersFromArguments(
					paramsDefinition,
					[`${type}:`]
				);

				assert.strictEqual(result.success, false, `Param parsing must fail for type ${type}: ${JSON.stringify(result)}`);
			}
		});

		it("fails for empty explicit non-string param", () => {
			for (const type of nonStringTypes) {
				const result = Command.parseParametersFromArguments(
					paramsDefinition,
					[`${type}:""`]
				);

				assert.strictEqual(result.success, false, `Param parsing must fail for type ${type}: ${JSON.stringify(result)}`);
			}
		});

		it("fails for an unrecognized type", () => {
			const result = Command.parseParametersFromArguments(
				[{ name: "foo", type: "UNSUPPORTED_TYPE" }],
				[`foo:bar`]
			);

			assert.strictEqual(result.success, false, `Param parsing must fail for unrecognized type: ${JSON.stringify(result)}`);
		});

		it("fails for unclosed quoted values", () => {
			for (const type of Object.keys(sampleStringValues)) {
				const result = Command.parseParametersFromArguments(
					paramsDefinition,
					[`${type}:"foo`, `bar`]
				);

				assert.strictEqual(result.success, false, `Param parsing must fail for unclosed quoted values: ${JSON.stringify(result)}`);
				assert.match(result.reply, /^Unclosed quoted parameter/, "Error message must be valid");
			}
		});

		describe("invalid value types", () => {
			it("fails for boolean", () => {
				const invalidValues = ["FALSE", "foo", "TRUE", ""];
				for (const value of invalidValues) {
					const result = Command.parseParametersFromArguments(paramsDefinition, [`boolean:${value}`]);
					assert.strictEqual(result.success, false, `Param parsing must fail: ${JSON.stringify(result)}`);
				}
			});

			it("fails for number", () => {
				const invalidValues = ["foo", "NaN", "Infinity", "-Infinity"];
				for (const value of invalidValues) {
					const result = Command.parseParametersFromArguments(paramsDefinition, [`number:${value}`]);
					assert.strictEqual(result.success, false, `Param parsing must fail: ${JSON.stringify(result)}`);
				}
			});

			it("fails for date", () => {
				const invalidValues = ["foo", "Infinity", "-Infinity", "NaN", "9".repeat(100)];
				for (const value of invalidValues) {
					const result = Command.parseParametersFromArguments(paramsDefinition, [`date:${value}`]);
					assert.strictEqual(result.success, false, `Param parsing must fail: ${JSON.stringify(result)}`);
				}
			});

			it("fails for duplicate object type values", () => {
				const paramCombinations = [
					[`object:foo=bar`, `object:foo=baz`],
					[`object:"foo=bar"`, `object:foo=baz`],
					[`object:foo=bar`, `object:"foo=baz"`],
					[`object:"foo=bar"`, `object:"foo=baz"`]
				];

				for (const params of paramCombinations) {
					const result = Command.parseParametersFromArguments(paramsDefinition, params);
					assert.strictEqual(result.success, false, `Param parsing must fail for object type: ${JSON.stringify(result)}`);
					assert.match(result.reply, /^Cannot use multiple values/, "Error message must be valid");
				}
			});
		});
	});

	it("returns a correctly typed single argument", () => {
		for (const delimiter of ["", "\""]) {
			for (const { name, type } of paramsDefinition) {
				// console.log({ sb });
				const result = Command.parseParametersFromArguments(
					paramsDefinition,
					[`${name}:${delimiter}${sampleStringValues[type]}${delimiter}`]
				);

				assert.strictEqual(result.success, true, `Param parsing must not fail: ${JSON.stringify(result)}`);
				assert.strictEqual(Object.keys(result.parameters).length, 1, "Exactly one param must be extracted");
				assert.strictEqual(result.args.length, 0, "Remaining args must be an empty array");

				const value = result.parameters[name];
				checkParameterType(value, type);
			}
		}
	});

	it("returns a correctly typed single argument and remaining non-param args", () => {
		const remaining = ["a", "b", "c"];
		const result = Command.parseParametersFromArguments(
			paramsDefinition,
			["boolean:false", ...remaining]
		);

		assert.strictEqual(result.success, true, `Param parsing must not fail: ${JSON.stringify(result)}`);
		assert.strictEqual(Object.keys(result.parameters).length, 1, "Exactly one param must be extracted");

		assert.strictEqual(result.args.length, remaining.length, "Remaining args must be correct length");
		assert.deepStrictEqual(result.args, remaining, "Remaining args must be correctly ordered and equal");
	});

	it("overrides a duplicate parameter", () => {
		const result = Command.parseParametersFromArguments(
			paramsDefinition,
			["string:foobar", "string:barbaz"]
		);

		assert.notStrictEqual(result.success, false, `Param parsing must not fail: ${JSON.stringify(result)}`);
		assert.strictEqual(Object.keys(result.parameters).length, 1, "Exactly one param must be extracted");
		assert.strictEqual(result.args.length, 0, "Remaining args should be empty");

		assert.strictEqual(result.parameters.string, "barbaz", "Extracted param should have the correct overriden value");
	});

	it("extracts multiple parameters", () => {
		const params = Object.entries(sampleStringValues).map(([key, value]) => `${key}:${value}`);
		const result = Command.parseParametersFromArguments(paramsDefinition, params);

		assert.strictEqual(result.success, true, `Param parsing must not fail: ${JSON.stringify(result)}`);
		assert.strictEqual(Object.keys(result.parameters).length, params.length, "All params must be extracted");
		assert.strictEqual(result.args.length, 0, "No remaining args should be present");

		for (const [name, value] of Object.entries(result.parameters)) {
			checkParameterType(value, name);
		}
	});

	it("separates an argument following a quoted value without a space into a separate argument", () => {
		const result = Command.parseParametersFromArguments(
			paramsDefinition,
			[`string:"foo bar"buz`]
		);

		assert.strictEqual(result.success, true, `Param parsing must not fail: ${JSON.stringify(result)}`);
		assert.strictEqual(result.parameters.string, "foo bar", `Parameter must be parsed correctly`);
		assert.deepStrictEqual(result.args, ["buz"], `Argument must be separated from parameter`);
	});

	it("properly reads escaped quotes inside quoted parameters", () => {
		const tests = [
			{ input: `string:"\\"bar\\""`, expected: `"bar"` },
			{ input: `string:" \\" "`, expected: ` " ` },
			{ input: `string:"\\""`, expected: `"` }
		];

		for (const test of tests) {
			const result = Command.parseParametersFromArguments(paramsDefinition, test.input.split(" "));
			assert.strictEqual(result.success, true, `Param parsing must not fail: ${JSON.stringify(result)}`);
			assert.strictEqual(result.parameters.string, test.expected, `Quotes must be read properly when escaped`);
		}
	});

	describe("parameters ignore delimiter", () => {
		const originalDelimiterDefinition = Command.ignoreParametersDelimiter;
		const delimiter = "--";

		beforeEach(() => {
			Command.ignoreParametersDelimiter = delimiter;
		});
		afterEach(() => {
			Command.ignoreParametersDelimiter = originalDelimiterDefinition;
		});

		it("should ignore parameters after the delimiter", () => {
			const result = Command.parseParametersFromArguments(
				paramsDefinition,
				["string:string", delimiter, "number:123"]
			);

			assert.strictEqual(result.success, true, `Param parsing must not fail: ${JSON.stringify(result)}`);
			assert.strictEqual(Object.keys(result.parameters).length, 1, `Only params with regard to the delimiter must be extracted: ${JSON.stringify(result.parameters)}`);

			assert.strictEqual(result.args.length, 1, "Only one argument should be left over");
			assert.strictEqual(result.args[0], "number:123", "Only argument remaining should be the ignored parameter");

			assert.strictEqual(typeof result.parameters.string, "string", "Extracted param must have correct type");
		});

		it("should not ignore parameters if the delimiter is not used", () => {
			Command.ignoreParametersDelimiter = null;

			const result = Command.parseParametersFromArguments(
				paramsDefinition,
				["string:string", delimiter, "number:123"]
			);

			assert.strictEqual(result.success, true, `Param parsing must not fail: ${JSON.stringify(result)}`);
			assert.strictEqual(Object.keys(result.parameters).length, 2, "All params regardless of delimiter must be extracted");
			assert.strictEqual(result.args.length, 1, "The delimiter must be present in the args");
			assert.strictEqual(result.args[0], delimiter, "The delimiter must be unchanged");

			assert.strictEqual(typeof result.parameters.string, "string", "Extracted params must have correct type");
			assert.strictEqual(typeof result.parameters.number, "number", "Extracted params must have correct type");
		});

		it("only removes a single instance of the delimiter", () => {
			const result = Command.parseParametersFromArguments(
				paramsDefinition,
				[delimiter, delimiter, delimiter, delimiter, delimiter]
			);

			assert.strictEqual(result.success, true, `Param parsing must not fail: ${JSON.stringify(result)}`);
			assert.deepStrictEqual(
				result.args,
				[delimiter, delimiter, delimiter, delimiter],
				"Exactly one copy of the delimiter must be removed"
			);
		});

		it("can be present anywhere in the arguments", () => {
			const tests = [
				[delimiter, "foo", "bar", "fee"],
				["foo", delimiter, "bar", "fee"],
				["foo", "bar", delimiter, "fee"],
				["foo", "bar", "fee", delimiter]
			];

			const resultArguments = ["foo", "bar", "fee"];

			for (const testCase of tests) {
				const result = Command.parseParametersFromArguments([], testCase);

				assert.strictEqual(result.success, true, `Param parsing must not fail: ${JSON.stringify(result)}`);
				assert.deepStrictEqual(result.args, resultArguments, "Arguments must be returned properly");
			}
		});

		it("can be used as part of a quoted parameter", () => {
			const tests = [
				[`string:"foo`, delimiter, `bar"`]
			];

			for (const testCase of tests) {
				const result = Command.parseParametersFromArguments(paramsDefinition, testCase);

				assert.strictEqual(result.success, true, `Param parsing must not fail: ${JSON.stringify(result)}`);
				assert.strictEqual(result.args.length, 0, "No arguments must be returned");
				assert.strictEqual(result.parameters.string, `foo ${delimiter} bar`);
			}
		});
	});
});
