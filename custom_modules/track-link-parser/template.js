module.exports = (function () {
	"use strict";

	return class TrackParsingTemplate {
		static check () {
			throw new Error("Method check() must be implemented");
		}

		static checkAvailable () {
			throw new Error("Method checkAvailable() must be implemented");
		}

		static fetchData () {
			throw new Error("Method fetchData() must be implemented");
		}
	};
})();