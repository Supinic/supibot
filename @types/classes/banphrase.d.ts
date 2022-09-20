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

/**
 * Represents a single output modifier that will change the output of the bot in specified channel/platform.
 * Represents a chat banphrase, used to filter the bot's responses when invoking commands
 * or otherwise posting messages into a channel.
 * Note: this does NOT represent a banphrase that the bot then uses to moderate a channel!
 */
export declare class Banphrase extends ClassTemplate {
    /**
     * Fetches a banphrase, based on the identifier provided.
     */
    static get (identifier: Like): Banphrase | null;

    /**
     * Checks all banphrases associated with given channel and platform. Global ones are checked as well.
     * If a channel is configured to use an external API, that one is checked too.
     */
    static execute (message: Message, channelData: Channel | null, options: unknown): Promise<Result>;

    /**
     * Checks an external banphrase API.
     * @param message Message to be checked
     * @param type Type of banphrase API - required to build request URL and data parsing
     * @param URL Banphrase API URL
     * @param options extra options
     * @param options.fullResponse If true, returns the entire API response. Otherwise, returns
     * string (if banphrased) or false.
     */
    static executeExternalAPI (
        message: Message,
        type: ExternalBanphraseType,
        URL: string,
        options: ExternalOptions
    ): Promise<ExternalAPIResponse | string | boolean>;

    /**
     * Unique numeric ID.
     */
    readonly ID: number;

    /**
     * Type of banphrase.
     * Inactive: Banphrase is not active, will not be loaded or triggered.
     * Denial: If the result is not undefined, there will be no reply at all.
     * Replacement: Runs the message through String.prototype.replace and returns the result.
     * Custom response: If the result is not undefined, the reply will be completely replaced with the result of the function.
     * API response: Not technically a banphrase, simply returns custom text based on what a banphrase API returned.
    */
    readonly Type: Type;

    /**
     * Channel of the banphrase.
     */
    readonly Platform: Platform["ID"] | null;

    /**
     * Channel of the banphrase.
     * If null, then the banphrase applies to the entire {@link sb.Platform}.
     */
    readonly Channel: Channel["ID"] | null;

    /**
     * Determines if a banphrase is to be executed.
     */
    readonly Active: boolean;

    /**
     * Actual code function of the banphrase.
     */
    readonly Code: (message: Message) => string | undefined | Promise<string | undefined>;

    /**
     * Wrapper for the instance's custom data.
     */
    readonly data: SimpleGenericData;

    constructor (data: ConstructorData);

    // cannot directly assign `inactiveSymbol` here
    // https://github.com/microsoft/TypeScript/issues/37469
    execute (message: Message): ReturnType<Banphrase["Code"]> | symbol;

    /**
     * Toggles the banphrase's activity flag.
     */
    toggle (): Promise<void>;
}
