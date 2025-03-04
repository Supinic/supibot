export type Message = string;
export type Emote = {
    ID: string | number;
    name: string;
    type: "twitch-subscriber" | "twitch-global" | "ffz" | "bttv" | "7tv" | "discord" | "cytube";
    global: boolean;
    animated: boolean | null;
    guild?: string;
    zeroWidth?: boolean;
};
export type Port = number;
export type URL = string;
export type Stringifiable = boolean | number | string;
export type JSONifiable = null | boolean | number | string | { [P: string]: JSONifiable } | JSONifiable[];
export type SimpleGenericData = Record<string, JSONifiable>;
export interface GenericFlagsObject {
    [key: string]: boolean
}
export type Without<T, U> = {
    [P in Exclude<keyof T, keyof U>]?: never
};
export type XOR<T, U> = (T | U) extends object
    ? (Without<T, U> & U) | (Without<U, T> & T)
    : T | U;
export type OnlyKeysOfType<T, U> = {
    [P in keyof T]: T[P] extends U ? P : never
}[keyof T];
export type TypeExtract<T, U> = {
    [P in OnlyKeysOfType<T, U>]: U;
};
