// Prevents (at least attempts to prevent) some of the most popular sandbox escape methods
export default () => {
	Function.prototype.constructor = () => {};

	const AsyncFunctionPrototype = Object.getPrototypeOf(async () => {});
	Object.defineProperty(AsyncFunctionPrototype, "constructor", { value: () => {} });
};
