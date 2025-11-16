export const typedKeys = <T extends object> (object: T): (keyof T)[] => (
	Object.keys(object) as (keyof T)[]
);

export const typedEntries = <T extends object> (object: T): [keyof T, T[keyof T]][] => (
	Object.entries(object) as [keyof T, T[keyof T]][]
);

export const filterNonNullable = <T> (array: T[]): NonNullable<T>[] => array.filter(i => i !== null && i !== undefined);

export const hasKey = <T extends object> (obj: T, key: PropertyKey): key is keyof T => (Object.hasOwn(obj, key));
