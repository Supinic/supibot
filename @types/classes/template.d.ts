import { Row } from "../singletons/query";

type FailedReloadDescriptor = {
    identifier: string;
    reason: string; // "no-path"
}
type ReloadResult = {
    failed?: FailedReloadDescriptor[],
    success: boolean
};

export declare class ClassTemplate {
    static data: Map<string | number, ClassTemplate> | ClassTemplate[];

    serialize (row: Row, properties: object, options: object): Promise<{ string: string }>;

    getCacheData (key: string): Promise<any>;

    setCacheData (key: string, value: any, options: object): "OK";

    saveRowProperty (row: Row, property: string, value: any, self: ClassTemplate): ReturnType<Row["save"]>;

    static initialize(): Promise<ClassTemplate>;

    static loadData (): Promise<void>;
    static reloadData (): Promise<void>;

    static reloadSpecific (): Promise<ReloadResult>;
    static hasReloadSpecific (): boolean;

    // static get <Class> (identifier: string | Class): Class | null;

    destroy (): void;
}
