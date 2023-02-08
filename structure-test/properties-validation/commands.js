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
		name: "Aliases",
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
		name: "Cooldown",
		valueKind: "Literal",
		valueTypes: ["number"]
	},
	{
		name: "Flags",
		failMessage: "Object of string Literal keys and boolean Literal values, or string[], or null Literal",
		checkCallback: (v) => (
			(v.type === "ObjectExpression" && v.properties.every(i => i.value.type === "Literal" && typeof i.value.value === "boolean"))
			|| (v.type === "ArrayExpression" && v.elements.every(i => i.type === "Literal" && typeof i.value === "string"))
			|| (v.type === "Literal" && v.value === null)
		)
	},
	{
		name: "Params",
		failMessage: "Array of Objects with `name` as string, and `type` as string - one of: string, number, date, boolean; or null",
		checkCallback: (v) => {
			if (v.type === "Literal" && v.value === null) {
				return true;
			}
			else if (v.type !== "ArrayExpression") {
				return false;
			}

			const allowedTypes = ["boolean", "date", "number", "string", "object", "regex", "language"];
			const paramNames = new Set();
			const params = v.elements;
			for (const param of params) {
				if (param.type !== "ObjectExpression") {
					console.warn(`Param is not an ObjectExpression (${param.type})`);
					return false;
				}

				const props = param.properties;
				if (props.length !== 2) {
					console.warn(`Incorrect amount of properties (${props.length})`);
					return false;
				}

				const nameProp = props.find(i => i.key.name === "name");
				const typeProp = props.find(i => i.key.name === "type");
				if (!nameProp || nameProp.value.type !== "Literal" || typeof nameProp.value.value !== "string") {
					console.warn(`Invalid name property`);
					return false;
				}
				else if (paramNames.has(nameProp.value.value)) {
					console.warn(`Duplicate parameter name "${nameProp.value.value}"`);
					return false;
				}
				else if (!typeProp || typeProp.value.type !== "Literal" || !allowedTypes.includes(typeProp.value.value)) {
					console.warn(`Invalid type property`);
					return false;
				}

				paramNames.add(nameProp.value.value);
			}

			return true;
		}
	},
	{
		name: "Author",
		valueKind: "Literal",
		valueTypes: ["string", "null"]
	},
	{
		name: "Whitelist_Response",
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
		name: "Static_Data",
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
		name: "Dynamic_Description",
		failMessage: "null literal, non-generator FunctionExpression or ArrowFunctionExpression",
		checkCallback: (v) => (
			(v.type === "Literal" && v.value === null)
			|| (
				(v.type === "FunctionExpression" || v.type === "ArrowFunctionExpression")
				&& v.generator === false
				&& (typeof v.method !== "boolean" || v.method === false)
			)
		)
	}
];
