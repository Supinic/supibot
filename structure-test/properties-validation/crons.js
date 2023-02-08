module.exports = [
	{
		name: "Name",
		failMessage: "non-empty string",
		checkCallback: (v) => (
			(v.type === "Literal")
			&& (typeof v.value === "string") && (v.value.length > 0)
		)
	},
	{
		name: "Expression",
		failMessage: "non-empty cron expression string",
		checkCallback: (v) => (
			(v.type === "Literal")
			&& (typeof v.value === "string") && (v.value.length > 0)
		)
	},
	{
		name: "Description",
		valueKind: "Literal",
		valueTypes: ["string", "null"]
	},
	{
		name: "Defer",
		failMessage: "null literal, non-generator FunctionExpression or ArrowFunctionExpression",
		checkCallback: (v) => (
			(v.type === "Literal" && v.value === null)
			|| (
				(v.type === "FunctionExpression" || v.type === "ArrowFunctionExpression")
				&& v.generator === false
				&& (typeof v.method !== "boolean" || v.method === false)
			)
		)
	},
	{
		name: "Code",
		failMessage: "non-generator FunctionExpression or ArrowFunctionExpression",
		checkCallback: (v) => (
			(v.type === "FunctionExpression" || v.type === "ArrowFunctionExpression")
			&& v.generator === false && (typeof v.method !== "boolean" || v.method === false)
		)
	},
	{
		name: "Type",
		failMessage: "string, one of \"Bot\", \"Website\", \"All\"",
		checkCallback: (v) => (
			(v.type === "Literal" && ["All", "Bot", "Website"].includes(v.value))
		)
	}
];
