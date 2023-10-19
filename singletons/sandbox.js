// @todo this entire class can be removed by exporting the default options and just using `vm.run`
const vm2 = require("vm2");

/**
 * Sandbox module, created with the aim of running custom user input as safely as possible.
 */
module.exports = class SandboxSingleton {
	#VM = vm2.VM;
	#NodeVM = vm2.NodeVM;
	#defaultVMOptions = {
		sandbox: {},
		compiler: "javascript",
		eval: false,
		wasm: false,
		fixAsync: true,
		timeout: 5000
	};

	/**
	 * Runs given script inside of a provided secure VM
	 * @param {string} script
	 * @param {Object} options
	 * @returns {*}
	 */
	run (script, options = {}) {
		const vm = new this.#VM({
			...this.#defaultVMOptions,
			...options
		});

		return vm.run(script);
	}

	get VM () { return this.#VM; }
	get NodeVM () { return this.#NodeVM; }
	get modulePath () { return "sandbox"; }

	destroy () {
		this.#VM = null;
		this.#NodeVM = null;
	}
};
