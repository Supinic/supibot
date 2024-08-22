// Prevents (at least attempts to prevent) some of the most popular sandbox escape methods
const preventTomfoolery = () => {
	const NOOP = () => {};
	Function.prototype.constructor = NOOP;

	const AsyncFunctionPrototype = Object.getPrototypeOf(async function () {})
	Object.defineProperty(AsyncFunctionPrototype, "constructor", { value: NOOP });
};

module.exports = {
	preventTomfoolery
};
