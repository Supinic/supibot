declare type NameDescriptor = {
    native: {
        short: string;
        long: string;
    };
    english: {
        short: string;
        long: string;
    };
    transliterations: string[];
    other: string[];
};

declare type IsoCode = "iso6391" | "iso6392" | "iso6393";
declare type IsoType = 1 | 2 | 3;

export declare class Language {
    private constructor (data: LanguageData);

    public getIsoCode (type: IsoType): string;
    public get name (): string;
    public get glottolog (): string | null;
    public get aliases (): string[];
}

export declare type LanguageData = {
    group: string;
    names: string[] | NameDescriptor;
    iso6391: string;
    iso6392: string;
    iso6393: string;
    glottolog?: string;
};

export default class Parser {
    static getCode (string: string, targetCode?: IsoCode): LanguageData[IsoCode];
    static getLanguage (string: string): Language;
    static getName (string: string): string;
    static get (string: string): LanguageData | undefined;
    static search (string: string): LanguageData | null;
    static get languages (): LanguageData[];
}
