export type MapEntries <T extends Map<unknown, unknown>> = T extends Map<infer U, infer V> ? [U, V][] : never;

export const typedKeys = <T extends object> (object: T): (keyof T)[] => (
	Object.keys(object) as (keyof T)[]
);

export const typedEntries = <T extends object> (object: T): [keyof T, T[keyof T]][] => (
	Object.entries(object) as [keyof T, T[keyof T]][]
);

export const filterNonNullable = <T> (array: T[]): NonNullable<T>[] => array.filter(i => i !== null && i !== undefined);

export const hasKey = <T extends object> (obj: T, key: PropertyKey): key is keyof T => (Object.hasOwn(obj, key));

type GroupRecord <Required extends string, Optional extends string> =
	& Record<Required, string>
	& Record<Optional, string | undefined>;

export function typeRegexGroups<
	Required extends string,
	Optional extends string = never
> (matches: RegExpMatchArray): GroupRecord<Required, Optional> {
	if (!matches.groups) {
		throw new Error("Input RegExp does not contain groups");
	}

	return matches.groups as GroupRecord<Required, Optional>;
}
