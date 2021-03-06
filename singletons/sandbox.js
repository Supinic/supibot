module.exports = class Sandbox extends require("./template.js") {
	#VM;
	#NodeVM;
	#defaultVMOptions = {
		sandbox: {},
		compiler: "javascript",
		eval: false,
		wasm: false,
		fixAsync: true,
		timeout: 5000
	};

	static singleton () {
		if (!Sandbox.module) {
			let sandboxModule;
			try {
				sandboxModule = require("vm2");
				Sandbox.module = new Sandbox(sandboxModule);
			}
			catch {
				console.warn("Could not load the vm2 module for sb.Sandbox - skipping");
				Sandbox.module = {};
			}
		}

		return Sandbox.module;
	}

	constructor (sandboxModule) {
		super();
		this.#VM = sandboxModule.VM;
		this.#NodeVM = sandboxModule.NodeVM;
	}

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
		this.VM = null;
		this.NodeVM = null;
	}
};