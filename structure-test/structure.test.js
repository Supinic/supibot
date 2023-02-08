/* eslint-disable max-nested-callbacks */
const fs = require("fs");
const acorn = require("acorn-node");
const { strictEqual: equal } = require("assert");
const getType = (value) => (value === null) ? "null" : typeof value;

describe("global module suite", () => {
	const modules = [
		{
			name: "commands",
			singular: "command",
			directory: "commands",
			extension: "js",
			fileList: fs.readdirSync("./commands", { withFileTypes: true })
				.filter(i => i.isDirectory())
				.map(i => i.name),

			validProperties: require("./properties-validation/commands.js"),
			definitions: []
		},
		{
			name: "chat modules",
			singular: "chat module",
			directory: "chat-modules",
			extension: "mjs",
			fileList: fs.readdirSync("./chat-modules", { withFileTypes: true })
				.filter(i => i.isDirectory())
				.map(i => i.name),
			validProperties: require("./properties-validation/chat-modules.js"),
			definitions: []
		},
		{
			name: "crons",
			singular: "cron",
			directory: "crons",
			extension: "mjs",
			fileList: fs.readdirSync("./crons", { withFileTypes: true })
				.filter(i => i.isDirectory())
				.map(i => i.name),
			validProperties: require("./properties-validation/crons.js"),
			definitions: []
		}
	];

	for (const specificModule of modules) {
		const { extension } = specificModule;
		specificModule.definitions = specificModule.fileList.map(dir => ({
			name: dir,
			content: fs.readFileSync(`./${specificModule.directory}/${dir}/index.${extension}`)
		}));
	}

	describe("total modules structure", () => {
		for (const module of modules) {
			describe(`${module.name} - structure`, () => {
				for (const { content, name } of module.definitions) {
					it(`${name}`, () => {
						let model = null;
						try {
							model = acorn.parse(content, {
								ecmaVersion: 2022,
								sourceType: "module"
							});
						}
						catch (e) {
							throw new Error(`Parsing of command failed\n\n${content}\n\n${e.toString()}`);
						}

						equal(model.type, "Program", "Module must be a program");
						equal(model.sourceType, "module", "Script must be sourced by a module");
						equal(model.body.constructor, Array, "Module body must be an array");
						equal(model.body.length, 1, "Module can only contain one statement");

						let properties;
						if (module.extension === "js") {
							equal(model.body[0].type, "ExpressionStatement", "Statement must be an expression");

							const expr = model.body[0].expression;
							equal(expr.type, "AssignmentExpression", "Statement must be an assignment expression");
							equal(expr.operator, "=", "Statement must use the = operator");

							const { left, right } = expr;
							equal(left.computed, false, "Left side of assignment cannot be computed");
							equal(left.object.name, "module", "Assignment must be done to module.exports");
							equal(left.object.type, "Identifier", "Assignment must be done to module.exports");
							equal(left.property.name, "exports", "Assignment must be done to module.exports");
							equal(right.type, "ObjectExpression", "Right side of assignment must be an object expression");

							properties = right.properties;
						}
						else {
							equal(model.body[0].type, "ExportNamedDeclaration", "Statement must be a named exports declaration");

							const { declaration } = model.body[0];
							equal(declaration.type, "VariableDeclaration", "Exports declaration must be a variable");
							equal(declaration.kind, "const", "Exports declaration must be const");

							const { declarations } = declaration;
							equal(declarations.length, 1, "Exactly one declaration must be exported");

							const { id, init } = declarations[0];
							equal(id.name, "definition", "Declared variable must be named \"definition\"");
							equal(init.type, "ObjectExpression", "Declared variable must be an object expression");

							properties = init.properties;
						}

						const foundProperties = new Set();
						for (const item of properties) {
							if (item.computed === true) {
								throw new Error(`computed expressions are not allowed`);
							}
							else if (item.shorthand === true) {
								throw new Error(`shorthand expressions are not allowed`);
							}
							else if (item.kind === "set" || item.kind === "get") {
								throw new Error(`${item.kind}ter methods are not allowed`);
							}
							else if (item.value && item.value.generator === true) {
								throw new Error("generator methods are not allowed");
							}

							const found = module.validProperties.find(i => i.name === item.key.name);
							if (!found) {
								throw new Error(`property ${item.key.name} is not allowed`);
							}
							else if (found.valueKind && item.value.type !== found.valueKind) {
								throw new Error(`property ${item.key.name} has invalid value-kind ${item.value.type} - expected ${found.valueKind}`);
							}
							else if (found.valueTypes && !found.valueTypes.includes(getType(item.value.value))) {
								throw new Error(`property ${item.key.name} has invalid value-type ${typeof item.value.value} - expected ${found.valueTypes.join("|")}`);
							}
							else if (typeof found.checkCallback === "function" && !found.checkCallback(item.value)) {
								throw new Error(`property ${item.key.name} must be ${found.failMessage}`);
							}

							if (foundProperties.has(found.name)) {
								throw new Error(`Duplicate property ${found.name}`);
							}
							else {
								foundProperties.add(found.name);
							}
						}

						const missingProperties = module.validProperties.filter(i => !foundProperties.has(i.name));
						if (missingProperties.length !== 0) {
							throw new Error(`Missing properties: ${missingProperties.map(i => i.name)
								.join(", ")}`);
						}
					});
				}
			});
		}
	});
});
