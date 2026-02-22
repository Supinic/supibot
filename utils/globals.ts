declare global {
    interface RegExpConstructor {
        /**
         * @todo Temporary declaration augment, remove when baseline in TS (wasn't in 5.9.2)
         * Escape any special regex characters in `text`.
         * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/escape
         */
        escape (str: string): string;
    }
}

type BaseEmote = {
    ID: string | number;
    name: string;
    global: boolean;
    animated: boolean | null;
};
export type ThirdPartyEmote = BaseEmote & {
    type: "ffz" | "bttv" | "7tv" | "cytube";
    zeroWidth: boolean;
}
export type TwitchEmote = BaseEmote & {
    type: "twitch-subscriber" | "twitch-global" | "twitch-follower";
    channel: string;
};
export type DiscordEmote = BaseEmote & {
    type: "discord";
    guild: string;
};
export type Emote = TwitchEmote | DiscordEmote | ThirdPartyEmote;

export type Coordinates = { lat: number; lng: number; } | { lat: string; lng: string; };

export type Port = number;
export type URL = string;
export type Stringifiable = boolean | number | string;
export type JSONifiable = null | boolean | number | string | { [P: string]: JSONifiable } | readonly JSONifiable[];
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
