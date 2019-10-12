module.exports = (function () {
	const request = require("request");
	return (...args) => new Promise((resolve, reject) => {
		request(...args, (err, resp, body) => {
			if (err) {
				reject(err);
			}
			else {
				if (args[0] && typeof args[0] === "object" && args[0].useFullResponse === true) {
					resolve(resp);
				}
				else {
					resolve(body);
				}
			}
		});
	});
})();