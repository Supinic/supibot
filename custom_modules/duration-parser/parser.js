/**
 * Parses strings containing time units into a time number.
 * @type {module.DurationParser}
 */
module.exports = class DurationParser {
	constructor () {
		this.durationRegex = /(-?\d*\.?\d+(?:e[-+]?\d+)?)\s*([a-zμ]*)/ig;
		this.unitsDefinition = JSON.parse( require("fs").readFileSync(__dirname + "/units.json").toString());
	}

	/**
	 * Parses strings containing time units into a time number.
	 * @param string
	 * @param {TimeUnit} target="ms"
	 * @param {boolean} ignoreError=true
	 * @returns {number}
	 */
	parse (string, target = "ms", ignoreError = true) {
		const targetUnit = this.unitsDefinition.find(i => i.name === target.toLowerCase() || i.aliases.some(j => j === target));
		if (!targetUnit) {
			throw new Error("Unrecognized target time unit: " + target);
		}

		let time = 0;
		string.replace(/(\d),(\d)/g, "$1$2").replace(this.durationRegex, (total, n, unit) => {
			let foundUnit = this.unitsDefinition.find(i => i.name === unit.toLowerCase() || i.aliases.some(j => j === unit));
			if (!foundUnit) {
				if (!unit) {
					foundUnit =  this.unitsDefinition.find(i => i.name === "second");
				}
				else {
					if (ignoreError) {
						return;
					}
					else {
						throw new Error("Unrecognized input time unit: " + unit);
					}
				}
			}

			time += parseFloat(n) * foundUnit.value;
		});

		return time * (1 / targetUnit.value);
	}
};

/**
 * @typedef {string} TimeUnit
 */