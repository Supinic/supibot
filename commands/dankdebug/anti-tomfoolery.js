// Prevents (at least attempts to prevent) some of the most popular sandbox escape methods
const preventTomfoolery = () => {
	Function.prototype.constructor = () => {};
	Object.getPrototypeOf(async function () {}).constructor = () => {};
};

module.exports = {
	preventTomfoolery
};
