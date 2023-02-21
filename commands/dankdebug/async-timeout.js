/**
 * This method makes sure that even a "promise bomb" script execution will
 * eventually timeout and reject. This is achieved via the usage of `process.nextTick` and manually checking
 * whether or not the underlying promise is finished. If, still, after the threshold timer is passed, the promise is
 * still pending, it will forcefully be rejected with the `sb.Promise` "remote rejection" API. This is then handled
 * by the command execution itself as a normal error rejection.
 * @param {script} script
 * @param {Object} context
 * @returns {Promise<any>}
 */
const safeAsyncScriptExecute = async (script, context) => {
	let executionFinished = false;
	const nextTickHandler = () => {
		if (executionFinished === true) {
			return;
		}

		const now = process.hrtime.bigint();
		const delta = now - start;
		if (delta >= timeoutThreshold) {
			promise.reject(new Error("Asynchronous execution timed out"));
		}

		if (delta < timeoutThreshold) {
			process.nextTick(nextTickHandler);
		}
	};

	const timeoutThreshold = (context.timeout)
		? (context.timeout * 1e6) // convert context.timeout (in milliseconds) to hrtime (in nanoseconds)
		: 2.5e9; // default 2.5 seconds (2.5 * 10^9 ns)

	process.nextTick(nextTickHandler);

	const start = process.hrtime.bigint();
	const promise = new sb.Promise((resolve, reject) => {
		let result;
		try {
			result = sb.Sandbox.run(script, context);
		}
		catch (e) {
			executionFinished = true;
			return reject(e);
		}

		if (result instanceof Promise) {
			result
				.then(i => resolve(i))
				.catch(e => reject(e))
				.finally(() => { executionFinished = true; });
		}
		else {
			resolve(result);
			executionFinished = true;
		}
	});

	return await promise;
};

module.exports = {
	safeAsyncScriptExecute
};
