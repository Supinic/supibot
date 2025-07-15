export type Message = string;
export type Emote = {
    ID: string | number;
    name: string;
    type: "twitch-subscriber" | "twitch-global" | "twitch-follower" | "ffz" | "bttv" | "7tv" | "discord" | "cytube";
    global: boolean;
    animated: boolean | null;
    guild?: string;
    zeroWidth?: boolean;
};

export type Coordinates = { lat: number; lng: number; } | { lat: string; lng: string; };

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

type BaseIvrUserData = {
    login: string;
    id: string;
    bio: string | null;
    follows: null;
    followers: number;
    profileViewCount: null;
    chatColor: string;
    logo: string;
    banner: string;
    verifiedBot: null;
    createdAt: string;
    updatedAt: string;
    emotePrefix: string | null;
    roles: {
        isAffliate: boolean;
        isPartner: boolean;
        isStaff: boolean;
    };
    badges: {
        setId: string;
        title: string;
        description: string;
        version: string;
    }[];
    chatterCount: number | null;
    chatSettings: {
        chatDelayMs: number;
        followersOnlyDurationMinutes: number | null;
        slowModeDurationSeconds: number | null;
        blockLinks: boolean;
        isSubscribersOnlyModeEnabled: boolean;
        isEmoteOnlyModeEnabled: boolean;
        isFastSubsModeEnabled: boolean;
        isUniqueChatModeEnabled: boolean;
        requireVerifiedAccount: boolean;
        rules: string[];
    };
    stream: {
        title: string;
        id: string;
        createdAt: string;
        type: "live" | "rerun";
        viewersCount: number;
        game: {
            displayName: string;
        } | null;
    } | null;
    lastBroadcast: {
        startedAt: string;
        title: string;
    } | null;
    panels: { id: string; }[];
}
type RegularIvrUserData = BaseIvrUserData & {
    banned: false;
};
type BannedIvrUserData = BaseIvrUserData & {
    banned: true;
    banReason: "TOS_INDEFINITE" | "TOS_TEMPORARY" | "DMCA" | "DEACTIVATED";
};
export type IvrUserData = RegularIvrUserData | BannedIvrUserData;

export type IvrClipData = {
    clipKey: string | null;
    clip: {
      durationSeconds: number;
      id: string;
      title: string;
      slug: string;
      url: string;
      tiny: string;
      small: string;
      medium: string;
      createdAt: string;
      viewCount: number;
      game: {
          id: string;
          name: string;
      };
      broadcaster: {
          id: string;
          displayName: string;
      };
      curator: {
          id: string;
          displayName: string;
      };
      videoQualities: {
          frameRate: number;
          quality: string;
          sourceURL: string;
      }[];
    };
}

type IvrEmoteSuccess = {
    error: undefined;
    channelName: string | null;
    channelLogin: string | null;
    channelID: string | null;
    artist: string | null;
    emoteID: string;
    emoteCode: string;
    emoteURL: string;
    emoteSetID: string;
    emoteAssetType: string;
    emoteState: string;
    emoteType: string;
    emoteTier: "1" | "2" | "3" | null;
};
type IvrEmoteFailure = {
    emoteID: undefined;
    statusCode: number;
    error: {
        message: string;
    };
};
export type IvrEmoteData = IvrEmoteSuccess | IvrEmoteFailure;

