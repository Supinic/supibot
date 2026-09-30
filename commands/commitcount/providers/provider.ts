import type { SupiDate } from "supi-core";
import type { ResultFailure } from "../../../classes/command.ts";
import type User from "../../../classes/user.ts";

type GitProviderData = {
	user: User;
	threshold: SupiDate;
	username: string | null;
	host: string | null;
};

type GitProviderResult = {
	success: true;
	commitCount: number;
	self?: boolean;
	intervalEnd?: SupiDate;
};

export interface GitProvider {
	name: string;
	prettyName: string;
	flags?: { default: boolean };
	execute: (data: GitProviderData) => Promise<GitProviderResult | ResultFailure>;
}
