import { Message, OnlyKeysOfType, SimpleGenericData } from "../globals";
import { ClassTemplate } from "./template";
import { Channel } from "./channel";
import { Platform } from "./platform";

declare type ConstructorData = {
    ID?: number;
    Code: string;
    Type: Type;
    Platform: Platform["ID"] | null;
    Channel: Channel["ID"] | null;
    Active?: boolean;
};

export declare type DowntimeBehaviour = "Ignore" | "Notify" | "Nothing" | "Refuse" | "Whisper";
export declare type Type = "API response" | "Custom response" | "Denial" | "Inactive" | "Replacement";
export declare type Like = number | Banphrase;
export declare type Result = {
    string: Message | null;
    passed: boolean;
};

declare const apiDataSymbol: unique symbol;
declare const apiResultSymbol: unique symbol;
declare const inactiveSymbol: unique symbol;

declare type ExternalOptions = {
  fullResponse?: boolean;
};
declare type PajbotBanphraseAPIResponse = {
    banned: boolean;
    input_message: string;
    banphrase_data: {
        id: number;
        name: string;
        length: number;
        phrase: string;
        operator: string;
        permanent: boolean;
        sub_immunity: boolean;
        case_sensitive: boolean;
        remove_accents: boolean;
    };
    [apiDataSymbol]: PajbotBanphraseAPIResponse["banphrase_data"];
    [apiResultSymbol]: boolean;
}
declare type ExternalAPIResponse = PajbotBanphraseAPIResponse;

declare class ExternalBanphraseAPI {
    static pajbot (message: Message, URL: string): Promise<PajbotBanphraseAPIResponse>;
}

declare type ExternalBanphraseType = OnlyKeysOfType<typeof ExternalBanphraseAPI, (message: Message, URL: string) => any>;
export declare type APIType = Uppercase<ExternalBanphraseType>;

export declare class Banphrase extends ClassTemplate {
    static get (identifier: Like): Banphrase | null;
    static execute (message: Message, channelData: Channel, options: unknown): Promise<Result>;
    static executeExternalAPI (
        message: Message,
        type: ExternalBanphraseType,
        URL: string,
        options: ExternalOptions
    ): Promise<ExternalAPIResponse | string | boolean>;

    readonly ID: number;
    readonly Type: Type;
    readonly Platform: Platform["ID"] | null;
    readonly Channel: Channel["ID"] | null;
    readonly Active: boolean;
    readonly Code: (message: Message) => string | undefined | Promise<string | undefined>;
    readonly data: SimpleGenericData;

    constructor (data: ConstructorData);

    // cannot directly assign `inactiveSymbol` here
    // https://github.com/microsoft/TypeScript/issues/37469
    execute (message: Message): ReturnType<Banphrase["Code"]> | symbol;
}
