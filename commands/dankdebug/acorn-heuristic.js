import Acorn from "acorn-node";
const BANNED_AWAIT_STATEMENTS = new Set(["DoWhileStatement", "ForStatement", "ForOfStatement", "WhileStatement"]);

export default (script) => {
	let tree;
	try {
		tree = Acorn.parse(`(() => { ${script} })`, {
			ecmaVersion: 2022
		});
	}
	catch {
		return {
			illegalAsync: false
		};
	}

	const suspiciousNodes = new Set();
	const trackedNodes = new Set(tree.body);

	let hasNewPromise = false;
	for (const node of trackedNodes) {
		for (const potentialNode of Object.values(node)) {
			if (potentialNode) {
				trackedNodes.add(potentialNode);
			}
		}

		if (node instanceof Acorn.Node) {
			if (BANNED_AWAIT_STATEMENTS.has(node.type)) {
				suspiciousNodes.add(node);

				if (hasNewPromise) {
					return { // Heuristic - using any kind of loop while creating a new Promise in the same script is suspicious
						illegalAsync: true
					};
				}
			}
			if (node.type === "NewExpression" && node.callee?.name === "Promise") {
				hasNewPromise = true;
			}
		}

		trackedNodes.delete(node);
	}

	for (const node of suspiciousNodes) {
		for (const potentialNode of Object.values(node)) {
			if (potentialNode) {
				suspiciousNodes.add(potentialNode);
			}
		}

		if (node instanceof Acorn.Node && node.type === "AwaitExpression") {
			return {
				illegalAsync: true
			};
		}
	}

	return {
		illegalAsync: false
	};
};
