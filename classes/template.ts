import type { CacheValue, KeyObject, Row, JavascriptValue as RowValue, Query } from "supi-core";
import { SupiDate, SupiError } from "supi-core";

type PoolConnection = Awaited<ReturnType<Query["getTransaction"]>>;

type KeyLike = string | Record<string, string>;
type SetCacheOptions = Pick<KeyObject, "expiry" | "expiresAt" | "keepTTL">;
export type GenericDataPropertyObject<T extends Template> = {
	cacheMap: WeakMap<T, Map<string, GenericDataPropertyValue>>;
	databaseProperty: string;
	databaseTable: string;
	propertyName: string;
	propertyContext: string;
	instance: T;
	options: {
		forceCacheReload?: boolean;
		transaction?: PoolConnection;
	}
};
export type SetGenericDataPropertyObject<T extends Template> = GenericDataPropertyObject<T> & {
	value: GenericDataPropertyValue;
};
type SetGenericDataPropertyResult = {
	Type: "string" | "boolean" | "number" | "date" | "array" | "object";
	Cached: boolean;
};
type GenericDataPropertyResult = SetGenericDataPropertyResult & {
	Property: string;
	Value: string;
};
export type GenericDataPropertyValue = string | number | boolean | null | SupiDate | GenericDataPropertyValue[] | {
	[P: string]: GenericDataPropertyValue;
};

export interface TemplateDefinition {
	[P: string]: unknown;
}

export const getGenericDataProperty = async <T extends TemplateWithId>(inputData: GenericDataPropertyObject<T>) => {
	const {
		cacheMap,
		databaseProperty,
		databaseTable,
		instance,
		options,
		propertyName,
	} = inputData;

	const cache = cacheMap.get(instance);
	if (cache && cache.has(propertyName) && !options.forceCacheReload) {
		return cache.get(propertyName);
	}

	const rsOptions = (options.transaction) ? { transaction: options.transaction } : {};
	const data = await sb.Query.getRecordset<GenericDataPropertyResult | undefined>(
		rs => rs
			.select("Property", "Value")
			.select("Custom_Data_Property.Type AS Type", "Custom_Data_Property.Cached AS Cached")
			.from("chat_data", databaseTable)
			.leftJoin({
				toTable: "Custom_Data_Property",
				on: `Custom_Data_Property.Name = ${databaseTable}.Property`
			})
			.where(`${databaseProperty} = %n`, instance.ID)
			.where("Property = %s", propertyName)
			.limit(1)
			.single(),
		rsOptions
	);

	if (!data) {
		throw new SupiError({
			message: "Data property does not exist",
			args: { propertyName }
		});
	}

	let value: GenericDataPropertyValue;
	switch (data.Type) {
		case "boolean":
			value = (data.Value === "true");
			break;

		case "string":
			value = String(data.Value);
			break;

		case "number":
			value = Number(data.Value);
			break;

		case "date":
			value = new SupiDate(data.Value);
			break;

		case "array":
		case "object": {
			try {
				value = JSON.parse(data.Value);
			}
			catch (e) {
				console.warn(`Data property has invalid definition`, { data, error: e });
				value = (data.Type === "array") ? [] : {};
			}
			break;
		}
	}

	if (data.Cached) {
		if (!cacheMap.has(instance)) {
			cacheMap.set(instance, new Map());
		}

		const userCache = cacheMap.get(instance) as Map<string, GenericDataPropertyValue>; // Type known because of condition above
		userCache.set(propertyName, value);
	}

	return value;
};

export const setGenericDataProperty = async <T extends TemplateWithId>(self: T, inputData: SetGenericDataPropertyObject<T>) => {
	const {
		cacheMap,
		databaseProperty,
		databaseTable,
		propertyName,
		options,
		instance,
		value
	} = inputData;

	const transactionOptions = (options.transaction) ? { transaction: options.transaction } : {};
	const propertyData = await sb.Query.getRecordset<SetGenericDataPropertyResult | undefined>(
		rs => rs
			.select("Type", "Cached")
			.from("chat_data", "Custom_Data_Property")
			.where("Name = %s", propertyName)
			.limit(1)
			.single(),
		transactionOptions
	);

	if (!propertyData) {
		throw new SupiError({
			message: "Data property does not exist",
			args: { propertyName, propertyData }
		});
	}

	const row = await sb.Query.getRow("chat_data", databaseTable, transactionOptions);
	await row.load({
		[databaseProperty]: self.ID,
		Property: propertyName
	}, true);

	if (!row.loaded) {
		row.setValues({
			[databaseProperty]: self.ID,
			Property: propertyName
		});
	}

	if (value === null) {
		row.values.Value = null;
	}
	else if (propertyData.Type === "array" || propertyData.Type === "object") {
		row.values.Value = JSON.stringify(value);
	}
	else {
		row.values.Value = String(value);
	}

	if (propertyData.Cached) {
		if (!cacheMap.has(instance)) {
			cacheMap.set(instance, new Map());
		}

		const instanceCache = cacheMap.get(instance);
		instanceCache!.set(propertyName, value); // Type known because of condition above
	}

	await row.save({ skipLoad: true });
};

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

		return sb.Cache.getByPrefix(this.getCacheKey(), {
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

		return sb.Cache.setByPrefix(this.getCacheKey(), value, {
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

		let storedValue: RowValue = newValue as any;
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
	static async loadData () {
		throw new SupiError({
			message: "loadData method must be implemented in module",
			args: {
				name: this.name
			}
		});
	}

	static async reloadData () {
		this.data.clear();
		await this.loadData();
	}

	/**
	 * @abstract
	 */
	static importSpecific (...definitions: TemplateDefinition[]): Promise<Template[]> {
		throw new SupiError({
			message: "This method must be implemented by derived classes"
		});
	}

	// /**
	//  * @abstract
	//  * @todo reinstate in typescript
	//  */
	// static async get () {
	// 	throw new SupiError({
	// 		message: "get method must be implemented in module"
	// 	});
	// }
}

export abstract class TemplateWithId extends Template {
	abstract ID: number;
}

export abstract class TemplateWithIdString extends Template {
	abstract ID: number;
}

export abstract class TemplateWithoutId extends Template {}
