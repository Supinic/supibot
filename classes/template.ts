import { SupiError } from "supi-core";
import type { CacheValue, KeyObject, Recordset, Row, JavascriptValue as RowValue, Query, SupiDate } from "supi-core";
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
	Type?: "string" | "boolean" | "number" | "date" | "array" | "object";
	Cached: boolean;
};
type GenericDataPropertyResult = SetGenericDataPropertyResult & {
	Property: string;
	Value: string;
};
type GenericDataPropertyValue = string | number | boolean | null | SupiDate | GenericDataPropertyValue[] | {
	[P: string]: GenericDataPropertyValue;
};

export interface TemplateDefinition {
	[P: string]: unknown;
}
export interface TemplateWithIdDefinition extends TemplateDefinition {
	ID: number;
}

export type Constructable<T extends Template> = {
	new (definition: TemplateDefinition): T;
	importable: (typeof Template)["importable"];
	data: (typeof Template)["data"];
	get: (...args: unknown[]) => T | null;
};

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

	const { transaction = null } = options;
	const data = await sb.Query.getRecordset(
		(rs: Recordset) => rs
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
		{ transaction }
	) as GenericDataPropertyResult | undefined;

	if (!data) {
		return;
	}
	else if (!data.Type) {
		throw new sb.Error({
			message: "No type is associated with self variable",
			args: { options, property: propertyName }
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
			value = new sb.Date(data.Value);
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

	const { transaction = null } = options;
	const propertyData = await sb.Query.getRecordset(
		(rs: Recordset) => rs
			.select("Type", "Cached")
			.from("chat_data", "Custom_Data_Property")
			.where("Name = %s", propertyName)
			.limit(1)
			.single(),
		{ transaction }
	) as SetGenericDataPropertyResult;

	if (!propertyData.Type) {
		throw new sb.Error({
			message: "Data property has no type associated with it",
			args: { options, propertyName, propertyData }
		});
	}

	const row = await sb.Query.getRow("chat_data", databaseTable, { transaction });
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

		const instanceCache = cacheMap.get(instance) as Map<string, GenericDataPropertyValue>; // Type known because of condition above
		instanceCache.set(propertyName, value) ;
	}

	await row.save({ skipLoad: true });
};

abstract class Template {
	abstract getCacheKey (): string | never;
	abstract destroy (): void;

	static importable: boolean = false;
	static uniqueIdentifier: string;
	static data: Map<number, Template> | Map<string, Template>;

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
			throw new sb.Error({
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

	async saveRowProperty<T extends Template, K extends keyof T> (row: Row, property: K, value: T[K] | undefined, self: T) {
		if (!row.hasProperty(property as string)) {
			throw new sb.Error({
				message: "Row does not have provided property",
				args: {
					property,
					properties: Object.keys(row.valuesObject)
				}
			});
		}
		else if (!row.loaded) {
			throw new sb.Error({
				message: "Row must be loaded before any properties can be saved"
			});
		}

		let newValue: T[K];
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

	static clearData () {
		if (this.data.size !== 0) {
			for (const instance of this.data.values()) {
				instance.destroy();
			}

			this.data.clear();
		}
	}

	/**
	 * @abstract
	 */
	static async loadData () {
		throw new sb.Error({
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
		throw new sb.Error({
			message: "This method must be implemented by derived classes"
		});
	}

	// /**
	//  * @abstract
	//  * @todo reinstate in typescript
	//  */
	// static async get () {
	// 	throw new sb.Error({
	// 		message: "get method must be implemented in module"
	// 	});
	// }
}

export abstract class TemplateWithId extends Template {
	abstract ID: number;
	static data: Map<number, TemplateWithId>;
}

export abstract class TemplateWithoutId extends Template {
	static data: Map<string, TemplateWithoutId>;
}
