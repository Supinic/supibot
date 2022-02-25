import { SingletonTemplate as Template } from "./template";
import { Got } from "../classes/got";

export declare type Body = {
    success: boolean;
    body: string | null;
    error: string | null;
};
export declare type PostOptions = {
    name?: string;
    privacy?: Privacy;
    expiration?: AllowedExpiration;
    format?: string;
};
export declare type Privacy = "public" | "unlisted" | "private";

export declare type ExpirationObject = {
    never: "N";
    "10 minutes": "10M";
    "1 hour": "1H";
    "1 day": "1D";
    "1 week": "1W";
    "2 weeks": "2W";
    "1 month": "1M";
    "6 months": "6M";
    "1 year": "1Y";
};
export declare type Expiration = ExpirationObject[keyof ExpirationObject];
export declare type AllowedExpiration = keyof ExpirationObject | Expiration;

export declare class PastebinSingleton implements Template {
    static module: PastebinSingleton;
    static singleton (): PastebinSingleton;
    static getPrivacy (mode: number | string): Privacy;
    static getExpiration (string: AllowedExpiration): Expiration;

    #authData: string | null;
    #authenticationPending: boolean;
    #got: ReturnType<Got["extend"]>;

    constructor ();

    login (): Promise<void>;
    get (pasteID: string): Promise<Body>;
    post (text: string, options?: PostOptions): Promise<Body>;
    delete (): never;
    destroy (): void;

    get modulePath (): "pastebin";
}
