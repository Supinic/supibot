const { Node, parse } = require("acorn-node");
const bannedAwaitStatements = ["DoWhileStatement", "ForStatement", "ForOfStatement", "WhileStatement"];

const analyze = (script) => {
	let tree;
	try {
		tree = parse(`(() => { ${script} })`, {
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

		if (node instanceof Node) {
			if (bannedAwaitStatements.includes(node.type)) {
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

		if (node instanceof Node && node.type === "AwaitExpression") {
			return {
				illegalAsync: true
			};
		}
	}

	return {
		illegalAsync: false
	};
};

module.exports = {
	analyze
};
