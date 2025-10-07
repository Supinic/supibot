export async function resolve(specifier, context, nextResolve) {
	try {
		return await nextResolve(specifier, context, nextResolve);
	}
	catch (err) {
		if (!specifier.endsWith(".js")) {
			throw new Error("Cannot process non-JS files", { cause: err });
		}

		const ts = specifier.replace(/\.js$/, ".ts");
		try {
			return await nextResolve(ts, context, nextResolve);
		}
		catch {}

		const dts = specifier.replace(/\.js$/, ".d.ts");
		return await nextResolve(dts, context, nextResolve);
	}
}

export async function load (url, context, nextLoad) {
	if (url.endsWith(".d.ts")) {
		return {
			format: "module",
			source: "export {};",
			shortCircuit: true
		};
	}

	return nextLoad(url, context, nextLoad);
}
