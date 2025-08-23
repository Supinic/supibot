import { Command } from "../classes/command.js";
import { User } from "../classes/user.js";
import { TwitchPlatform } from "../platforms/twitch.js";

export const createTestUser = (opts: { Name?: string, ID?: number, } = {}) => new User({
	ID: opts.ID ?? 1,
	Name: opts.Name ?? "sample_user",
	Discord_ID: null,
	Twitch_ID: null,
	Started_Using: null
});

export const createTestPlatform = () => new TwitchPlatform({
	ID: 1,
	selfId: "123",
	logging: {},
	platform: {},
	messageLimit: 500,
	selfName: "Foo",
	active: true
});

export const createTestCommand = (opts: { Name?: string } = {}) => new Command({
	Name: opts.Name ?? "TEST_COMMAND",
	Aliases: [],
	Code: () => ({ reply: null }),
	Description: null,
	Cooldown: null,
	Flags: [],
	Params: [],
	Whitelist_Response: null,
	Dynamic_Description: () => []
});

export class FakeRecordset {
	private object: string | null = null;
	private fields: string[] = [];
	private conditions: unknown[] = [];
	private amount: number | null = null;
	private isSingle: boolean = false;

	select (...args: string[]) {
		this.fields.push(...args);
		return this;
	}

	from (object: string) {
		this.object = object;
		return this;
	}

	where (...args: unknown[]) {
		this.conditions.push(...args);
		return this;
	}

	limit (limit: number) {
		this.amount = limit;
		return this;
	}

	single () {
		this.isSingle = true;
		return this;
	}
}

export class FakeRow {
	values: Record<string, unknown> = {};
	stored: boolean = false;
	loaded: boolean = false;
	readonly schema: string;
	readonly table: string;

	constructor (schema: string, table: string) {
		this.schema = schema;
		this.table = table;
	}

	setValues (values: Record<string, unknown>) {
		this.values = values;
	}

	save () {
		this.stored = true;
	}

	load () {
		this.loaded = true;
	}
}
