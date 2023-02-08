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
		name: "Events",
		failMessage: "Array of string Literals, or null Literal",
		checkCallback: (v) => (
			(v.type === "ArrayExpression" && v.elements.every(i => i.type === "Literal" && typeof i.value === "string"))
			|| (v.type === "Literal" && v.value === null)
		)
	},
	{
		name: "Description",
		valueKind: "Literal",
		valueTypes: ["string", "null"]
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
		name: "Global",
		valueKind: "Literal",
		valueTypes: ["boolean"]
	},
	{
		name: "Platform",
		valueKind: "Literal",
		valueTypes: ["string", "null"]
	}
];
