export const typedKeys = <T extends object> (object: T): (keyof T)[] => (
	Object.keys(object) as (keyof T)[]
);

export const typedEntries = <T extends object> (object: T): [keyof T, T[keyof T]][] => (
	Object.entries(object) as [keyof T, T[keyof T]][]
);
