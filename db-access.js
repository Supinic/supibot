(function () {
	process.env.MARIA_USER = ""; // Database username
	process.env.MARIA_SOCKET_PATH = ""; // Database socket
	process.env.MARIA_PASSWORD = ""; // Database password
	process.env.MARIA_CONNECTION_LIMIT = Infinity; // Explicit database connection limit
})();