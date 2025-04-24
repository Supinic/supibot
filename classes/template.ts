import {
	SupiError,
	type CacheValue,
	type KeyObject,
	type Row,
	type JavascriptValue as RowValue
} from "supi-core";

type KeyLike = string | Record<string, string>;
type SetCacheOptions = Pick<KeyObject, "expiry" | "expiresAt" | "keepTTL">;

export interface TemplateDefinition {
	[P: string]: unknown;
}

abstract class Template {
	abstract getCacheKey (): string | never;
	abstract destroy (): void;

	static importable: boolean = false;
	static uniqueIdentifier: string;
	static data: Map<unknown, unknown>;

	async getCacheData (key: KeyLike): Promise<CacheValue> {
		if (typeof key === "string") {
			key = { type: key };
		}

		return core.Cache.getByPrefix(this.getCacheKey(), {
			keys: { ...key }
		});
	}

	async setCacheData (key: KeyLike, value: CacheValue, options: SetCacheOptions = {}) {
		if (typeof value === "undefined") {
			throw new SupiError({
				message: "Value must be passed to cache"
			});
		}

		if (typeof key === "string") {
			key = { type: key };
		}

		return core.Cache.setByPrefix(this.getCacheKey(), value, {
			keys: { ...key },
			...options
		});
	}

	async saveRowProperty<T extends keyof this> (row: Row, property: T, value: this[T] | undefined, self: this) {
		if (!row.hasProperty(property as string)) {
			throw new SupiError({
				message: "Row does not have provided property",
				args: {
					property: property as string,
					properties: Object.keys(row.valuesObject)
				}
			});
		}
		else if (!row.loaded) {
			throw new SupiError({
				message: "Row must be loaded before any properties can be saved"
			});
		}

		let newValue: this[T];
		if (typeof value !== "undefined") {
			self[property] = value;
			newValue = value;
		}
		else {
			newValue = self[property];
		}

		let storedValue: RowValue = newValue as RowValue;
		if (newValue && typeof newValue === "object" && newValue.constructor === Object) {
			storedValue = JSON.stringify(newValue);
		}

		row.values[property as string] = storedValue;
		await row.save();
	}

	static async initialize () {
		await this.loadData();
	}

	/**
	 * @abstract
	 */
	static loadData (): Promise<void> {
		throw new SupiError({
			message: `Class ${this.name} must implement the static loadData method`
		});
	}

	/**
	 * @abstract
	 */
	// Ignore eslint due to an "abstract" signature, unused `identifier`
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	static get (identifier: unknown): Template | null | Promise<Template | null> {
		throw new SupiError({
			message: `Class ${this.name} must implement the static get method`
		});
	}
}

export abstract class TemplateWithId extends Template {
	abstract ID: number;
}

export abstract class TemplateWithIdString extends Template {
	abstract ID: number;
}

export abstract class TemplateWithoutId extends Template {}
