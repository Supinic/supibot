import { SupiDate } from "supi-core";
import { getConfig } from "../config.js";
const { values: configValues } = getConfig();

type Identifier = string | number | symbol | null;
type CooldownConstructorData = {
	channel?: Identifier;
	command?: Identifier;
	user?: Identifier;
	expires: number;
};

abstract class Inhibitor {
	readonly abstract user: Identifier;
	abstract expires: number;
	abstract check (...args: Identifier[]): boolean;
	abstract revoke (): void;
}

class Cooldown implements Inhibitor {
	readonly #channel?: Identifier;
	readonly #user: Identifier;
	readonly #command?: Identifier;
	#expires: number;

	/**
	 * Creates a cooldown instance.
	 */
	constructor (data: CooldownConstructorData) {
		this.#channel = data.channel ?? null;
		this.#user = data.user ?? null;
		this.#command = data.command ?? null;
		this.#expires = data.expires;
	}

	/**
	 * Checks if a given combination of parameters connects to this instance.
	 * @returns True if cooldown applies and is active, false otherwise.
	 */
	check (channel: Identifier, user: Identifier, command: Identifier) {
		return (
			(this.#channel === null || channel === this.#channel)
			&& (this.#user === null || user === this.#user)
			&& (this.#command === null || command === this.#command)
			&& (Date.now() <= this.#expires)
		);
	}

	/**
	 * Sets the cooldown to not apply anymore by settings its expiry to zero.
	 */
	revoke () {
		this.#expires = 0;
	}

	get channel () { return this.#channel; }
	get user () { return this.#user; }
	get command () { return this.#command; }
	get expires () { return this.#expires; }
}

type PendingConstructorData = {
	description?: string;
	user?: Identifier;
	expires: number;
};

class Pending implements Inhibitor {
	readonly #description;
	readonly #user: Identifier;
	#expires: number;

	constructor (data: PendingConstructorData) {
		this.#user = data.user ?? null;
		this.#description = data.description ?? "N/A";
		this.#expires = data.expires;
	}

	check (user: Identifier) {
		return (
			(user === this.#user)
			&& (Date.now() <= this.#expires)
		);
	}

	revoke () {
		this.#expires = 0;
	}

	get user () { return this.#user; }
	get expires () { return this.#expires; }
	get description () { return this.#description; }
}

const isCooldown = (input: Inhibitor): input is Cooldown => (input instanceof Cooldown);
const isPending = (input: Inhibitor): input is Pending => (input instanceof Pending);

/**
 * Manages the cooldowns between each message sent to channels.
 */
export default class CooldownManager {
	private readonly data: Set<Inhibitor> = new Set();

	/**
	 * Checks if given combination of parameters has a cooldown pending.
	 * @returns `true` if it's safe to run the command, `false` if the execution should be denied.
	 */
	check (channel: Identifier, user: Identifier, command: Identifier, skipPending: boolean) {
		for (const inhibitor of this.data) {
			if (skipPending && inhibitor instanceof Pending) {
				continue;
			}

			const isActive = (inhibitor instanceof Cooldown)
				? inhibitor.check(channel, user, command)
				: inhibitor.check(user);

			if (isActive) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Sets a cooldown for given combination of parameters
	 */
	set (channel: Identifier, user: Identifier, command: Identifier, cooldown: number) {
		this.data.add(new Cooldown({
			channel,
			user,
			command,
			expires: Date.now() + cooldown
		}));

		this.prune();
	}

	/**
	 * Sets a pending cooldown (it's really a status) for given user.
	 */
	setPending (user: Identifier, description: string) {
		this.data.add(new Pending({
			user,
			description,
			expires: Date.now() + configValues.pendingCommandTimeout
		}));

		this.prune();
	}

	/**
	 * Prematurely revoke a Cooldown inhibitor given by its parameters.
	 */
	unset (channel: Identifier, user: Identifier, command: Identifier) {
		for (const inhibitor of this.data) {
			if (!isCooldown(inhibitor)) {
				continue;
			}
			if (inhibitor.channel !== channel || inhibitor.user !== user || inhibitor.command !== command) {
				continue;
			}

			inhibitor.revoke();
			this.data.delete(inhibitor);
		}
	}

	/**
	 * Prematurely unset a Pending inhibitor for given user.
	 */
	unsetPending (user: Identifier) {
		for (const inhibitor of this.data) {
			if (!isPending(inhibitor)) {
				continue;
			}
			if (inhibitor.user !== user) {
				continue;
			}

			inhibitor.revoke();
			this.data.delete(inhibitor);
		}
	}

	/**
	 * Fetches the Pending for given user. Used mostly for their description.
	 */
	fetchPending (user: Identifier): Pending | undefined {
		for (const inhibitor of this.data) {
			if (!isPending(inhibitor)) {
				continue;
			}
			if (inhibitor.user !== user || inhibitor.expires === 0) {
				continue;
			}

			return inhibitor;
		}
	}

	/**
	 * Removes expired inhibitors from the list.
	 */
	prune () {
		const now = SupiDate.now();
		for (const inhibitor of this.data) {
			if (inhibitor.expires > now) {
				continue;
			}

			inhibitor.revoke();
			this.data.delete(inhibitor);
		}
	}
}
