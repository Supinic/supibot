module.exports = (function () {
	"use strict";

	const Workerpool = require("workerpool");
	const math = require("mathjs");

	const limitedEval = math.eval;
	const replacements = [
		{ regex: /°/g, value: "deg" },
		{ regex: /π/g, value: "pi" }
	];

	math.import({
		print: () => { throw new Error("print is disabled"); }, 
		map: () => { throw new Error("map is disabled"); },
		import: () => { throw new Error("import is disabled"); },
		createUnit: () => { throw new Error("createUnit is disabled"); },
		eval: () => { throw new Error("eval is disabled"); },
		parse: () => { throw new Error("parse is disabled"); },
		simplify: () => { throw new Error("simplify is disabled"); },
	}, { override: true });

	math.config({
		number: "BigNumber", // Default type of number: 'number' (default), 'BigNumber', or 'Fraction
		// precision: 64        // Number of significant digits for BigNumbers
	});

	Workerpool.worker({
		math: function (expression) {
			for (const {regex, value} of replacements) {
				expression = expression.replace(regex, value);
			}

			const result = limitedEval(expression);
			if (typeof result === "function") {
				throw new Error("Invoking functions without inputs is not allowed");
			}
			else {
				return math.format(result, {
					notation: "auto",
					upperExp: 64,
					lowerExp: -64
				});
			}
		}
	});
})();