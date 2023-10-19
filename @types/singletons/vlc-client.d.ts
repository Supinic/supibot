import { Port, SimpleGenericData, URL } from "../globals";

export declare interface Information {
    chapter: number;
    chapters: number[];
    title: number;
    category: Category;
    titles: number[];
}

export declare interface Category {
    meta: Meta;
    [flux: string]: { [key: string]: string } | Meta;
}

export declare interface Flux {
    [flux: string]: string;
}

export declare interface Audiofilters {
    [filter: string]: string;
}

export declare interface Meta {
    encoded_by: string;
    filename: string;
}

export declare interface VideoEffects {
    hue: number;
    saturation: number;
    contrast: number;
    brightness: number;
    gamma: number;
}

export declare interface Node {
    id: string;
    name: string;
    ro: "rw" | "ro";
    current?: string;
    duration?: number;
    type?: "node" | "leaf";
    uri?: string;
}
export declare interface Root extends Node {
    children: Node[];
    name: "Playlist";
    type: "node";
    ro: "ro";
}

declare type Stats = { [key: string]: number };

declare type AspectRatio =
    | "1:1"
    | "4:3"
    | "5:4"
    | "16:9"
    | "16:10"
    | "221:100"
    | "235:100"
    | "239:100";

declare type State = "paused" | "playing" | "stopped";

declare type StatusBase = {
    fullscreen: boolean;
    stats: Stats | null;
    aspectratio: AspectRatio | null;
    audiodelay: number;
    apiversion: number;
    currentplid: number;
    time: number;
    volume: number;
    length: number;
    random: boolean;
    audiofilters: Audiofilters;
    rate: number;
    videoeffects: VideoEffects;
    state: State;
    loop: boolean;
    version: string;
    position: number;
    information: Information;
    repeat: boolean;
    subtitledelay: number;
    equalizer: any[];
};
declare type StatusPaused = StatusBase & {
    stats: Stats;
    aspectratio: AspectRatio;
    state: "paused";
};
declare type StatusPlaying = StatusBase & {
    stats: Stats;
    aspectratio: AspectRatio;
    state: "playing";
};
declare type StatusStopped = StatusBase & {
    stats: null;
    aspectratio: null;
    state: "stopped";
};
export declare type Status = StatusPaused | StatusPlaying | StatusStopped;

export enum OrderType {
    Normal = 0,
    Reverse = 1
}
export enum OrderMode {
    Id = 0,
    Name = 1,
    Author = 3,
    Random = 5,
    TrackNumber = 7
}

export declare class VLCClient {
    readonly #host: URL;
    readonly #port: Port;
    readonly #autoUpdate: boolean;
    readonly #changeEvents: boolean;
    readonly #authorization: `Basic ${string}`;
    readonly #tickLengthMs: number;
    readonly #longWaitMs: number;
    #status: Status;
    #playlist: unknown;
    #running: boolean;

    constructor (options: {
        host: string;
        port: number;
        username: string;
        password: string;
        autoUpdate: boolean;
        tickLengthMs: number;
        changeEvents: boolean;
        running: boolean;
    })

    #doTick (): Promise<void>;
    #sendCommand (scope: string, command: string, options: SimpleGenericData): Promise<void>;

    browse (path: string): Promise<Status>;
    updateStatus (): Promise<Status>;
    updatePlaylist (): Promise<Root>;
    updateAll (): Promise<[Status, Root]>;
    addToQueueAndPlay (uri: string, option?: "noaudio" | "novideo"): Promise<Status>;
    addToQueue (uri: string): Promise<Status>;
    addSubtitle (uri: string): Promise<Status>;
    play (id: number): Promise<Status>;
    pause (id: number): Promise<Status>;
    stop (): Promise<Status>;
    resume (): Promise<Status>;
    forcePause (): Promise<Status>;
    playlistNext (): Promise<Status>;
    playlistPrevious (): Promise<Status>;
    playlistDelete (id: number): Promise<Status>;
    playlistEmpty (): Promise<Status>;
    sortPlaylist (order: OrderType, mode: OrderMode): Promise<Status>;
    setAudioDelay (delay: number): Promise<Status>;
    setSubtitleDelay (delay: number): Promise<Status>;
    setPlaybackRate (rate: number): Promise<Status>;
    setAspectRatio (ratio: AspectRatio): Promise<Status>;
    setVolume (volume: number | string): Promise<Status>;
    setPreamp (value: number): Promise<Status>;
    setEqualizer (band: number, gain: number): Promise<Status>;
    setEqualizerPreset (id: number): Promise<Status>;
    toggleRandom (): Promise<Status>;
    toggleRepeat (): Promise<Status>;
    toggleFullscreen (): Promise<Status>;
    seek (time: number): Promise<Status>;
    seekToChapter (chapter: number): Promise<Status>;

    startRunning (): void;
    stopRunning (): void;
}
