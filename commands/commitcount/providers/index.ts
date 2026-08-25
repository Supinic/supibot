import GiteaHandler from "./gitea.js";
import GithubHandler from "./github.js";
import GitlabHandler from "./gitlab.js";
import type { GitProvider } from "./provider.js";
import { SupiError } from "supi-core";

const gitHandlers: GitProvider[] = [
	GiteaHandler,
	GithubHandler,
	GitlabHandler
];
export const gitHandlerMap = new Map(gitHandlers.map(i => [i.name, i]));
export const gitHandlerNames = gitHandlers.map(i => i.name);

const defaultProvider = gitHandlers.find(i => i.flags?.default);
if (!defaultProvider) {
	throw new SupiError({
		message: "Assert error: No default Git provider found"
	});
}

export const defaultGitProvider = defaultProvider;
