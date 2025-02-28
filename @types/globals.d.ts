import type * as core from "supi-core";

import type { AwayFromKeyboard } from "../classes/afk.ts";
import type { Banphrase } from "../classes/banphrase.ts";
import type { Channel } from "../classes/channel.ts";
import type { ChatModule } from "../classes/chat-module.ts";
import type { Command } from "../classes/command.ts";
import type { Filter } from "../classes/filter.ts";
import type { Reminder } from "../classes/remnider.ts";
import type { User } from "../classes/user.ts";

import type Logger from "../singletons/logger.js";
import type { Platform } from "../platforms/template.ts";

export declare type Message = string;
export declare type Emote = {
    ID: string;
    name: string;
    type: "twitch-subscriber" | "twitch-global" | "ffz" | "bttv" | "7tv";
    global: boolean;
    animated: boolean | null;
};
export declare type Port = number;
export declare type URL = string;
export declare type Stringifiable = boolean | number | string;
export declare type JSONifiable = null | boolean | number | string | { [P: string]: JSONifiable } | JSONifiable[];
export declare type SimpleGenericData = Record<string, JSONifiable>;
export declare interface GenericFlagsObject {
    [key: string]: boolean
}
export declare type Without<T, U> = {
    [P in Exclude<keyof T, keyof U>]?: never
};
export declare type XOR<T, U> = (T | U) extends object
    ? (Without<T, U> & U) | (Without<U, T> & T)
    : T | U;
export declare type OnlyKeysOfType<T, U> = {
    [P in keyof T]: T[P] extends U ? P : never
}[keyof T];
export declare type TypeExtract<T, U> = {
    [P in OnlyKeysOfType<T, U>]: U;
};

export var sb: {
    Got: core.Got,
    Query: core.Query,
    Metrics: core.Metrics,
    Utils: core.Utils,

    Platform: typeof Platform,
    Logger: Logger,

    AwayFromKeyboard: typeof AwayFromKeyboard,
    Banphrase: typeof Banphrase,
    Channel: typeof Channel,
    Command: typeof Command,
    Filter: typeof Filter,
    Reminder: typeof Reminder,
    User: typeof User
};
