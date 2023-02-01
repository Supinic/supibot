import {ColumnDefinition, Row, Table} from "../singletons/query";

import { Name as CacheName, Value as CacheValue } from "./config";
export { Name as CacheName, Value as CacheValue } from "./config";

/*
type FailedReloadDescriptor = {
    identifier: string;
    reason: string; // "no-path"
}
type ReloadResult = {
    failed?: FailedReloadDescriptor[],
    success: boolean
};
*/

export type GenericCacheMap<T extends ClassTemplate> = WeakMap<T, Map<CacheName, CacheValue>>;
export type SpecificCacheOptions = {
    forceCacheReload?: boolean;
};
type GenericCacheOptions<T extends ClassTemplate> = {
    cacheMap: GenericCacheMap<T>;
    databaseTable?: Table;
    databaseProperty: ColumnDefinition["name"];
    instance: ClassTemplate;
    options?: SpecificCacheOptions;
    propertyName: CacheName,
    propertyContext?: string;
};

export type GenericIdentifier<T extends ClassTemplate> = keyof T;
/**
 * @todo
 * this was supposed to be a generic data type that represents any of the subclasses' ConstructorParameters but it doesn't seem to work
 */
type GenericConstructorData = Record<string, any>;
type InvalidateRequireCacheOptions = {
    names: string[];
    requireBasePath: string;
    extraDeletionCallback?: (path: string) => string[];
};

export declare class ClassTemplate {
    static importable: boolean;
    static uniqueIdentifier: GenericIdentifier<ClassTemplate>;
    static data:
        ClassTemplate[]
        | Map<string | number, ClassTemplate>
        | Map<string | number, ClassTemplate[]>;

    serialize (row: Row, properties: object, options: object): Promise<{ string: string }>;
    getCacheData (key: string): Promise<any>;
    setCacheData (key: string, value: any, options: object): "OK";
    getGenericDataProperty<T extends ClassTemplate> (inputData: GenericCacheOptions<T>): Promise<CacheValue>;
    setGenericDataProperty<T extends ClassTemplate> (inputData: GenericCacheOptions<T>): Promise<void>;
    saveRowProperty (row: Row, property: string, value: any, self: ClassTemplate): ReturnType<Row["save"]>;

    static initialize (): Promise<ClassTemplate>;
    static importData (definitions: GenericConstructorData[]): Promise<void>;
    static importSpecific (...definitions: GenericConstructorData[]): Promise<void>;
    static genericImportSpecific<T extends ClassTemplate> (identifierProperty: GenericIdentifier<T>, ...definitions: GenericConstructorData[]): ClassTemplate[];
    static genericInvalidateRequireCache (options: InvalidateRequireCacheOptions): {
        failed: string[];
        succeeded: string[];
    };

    static loadData (): Promise<void>;
    static reloadData (): Promise<void>;
    static hasReloadSpecific (): boolean;

    // static get <Class> (identifier: string | Class): Class | null;

    destroy (): void;
}
