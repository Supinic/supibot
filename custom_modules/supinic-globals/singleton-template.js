/** @interface */
module.exports = class TemplateModule {
	/**
	 * Cleans up the module.
	 * All sub-classes must implement this method.
	 * @abstract
	 */
	destroy () {
		throw new sb.Error({ message: "Module.destroy is not implemented!" });
	}

	/**
	 * Reloads a given module.
	 */
	reload () {
		this.destroy();
		sb[this.name] = null;

		delete require.cache[require.resolve(__dirname + "/" + (this.modulePath || this.name))];
		sb[this.name] = require(__dirname + "/" + (this.modulePath || this.name))(Module);
	}

	/**
	 * File name of the module.
	 * All sub-classes must implement this getter.
	 * @abstract
	 */
	get modulePath () {
		throw new sb.Error({ message: "get Module.modulePath is not implemented!" });
	}
};