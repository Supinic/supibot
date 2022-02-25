import { SingletonTemplate as Template } from "./template";
import { Information, Node, Root, Status, VLCClient as Client } from "./vlc-client";
import { Port, SimpleGenericData, URL } from "../globals";

export declare type VLCOptions = {
    host: URL;
    baseURL: URL;
    port: Port;
    username: string;
    password?: string;
};
export declare type Video = {
    Added: Date;
    Duration: number;
    End_Time: number | null;
    ID: number;
    Length: number;
    Link: string;
    Name: string;
    Notes: string | null;
    Start_Time: number | null;
    Status: "Current" | "Inactive" | "Pending";
    User_Alias: number;
    VLC_ID: number;
    Video_Type: number;
};

declare type Action = "addToQueue"
    | "addToQueueAndPlay"
    | "addSubtitle"
    | "play"
    | "pause"
    | "stop"
    | "resume"
    | "forcePause"
    | "playlistDelete"
    | "playlistNext"
    | "playlistPrevious"
    | "playlistEmpty"
    | "sortPlaylist"
    | "toggleRandom"
    | "toggleLoop"
    | "toggleRepeat"
    | "toggleFullscreen"
    | "seek"
    | "seekToChapter";

declare type AddOptions = {
    startTime?: number | null;
    endTime?: number | null;
};
declare type Generic = SimpleGenericData;

export declare class VLCSingleton implements Template {
    static module: VLCSingleton;
    static singleton (): VLCSingleton;

    readonly client: Client;
    readonly baseURL: string;
    private seekValues: {
        start: number | null;
        end: number | null;
    }

    constructor (sandboxModule: VLCOptions);

    private initListeners (): void;

    private send (command: string, options?: Generic, parent?: string): Promise<Generic>;
    private getStatus (command: string, options?: Generic): Promise<Generic>;
    private getPlaylist (command: string, options?: Generic): Promise<Root>;
    private getDataByName (name: string, link: string): Promise<Node | undefined>;
    private matchParent (list: Root, targetID: number): Node | null;

    private status (): Promise<Status>;
    private playlist (): Promise<Root>;

    private get currentPlaylist (): Video[];
    private get currentPlaylistItem (): Video | null;

    previous (): Promise<Status>;
    next (): Promise<Status>;
    delete (id: string): Promise<Status>;
    add (link: string, options?: AddOptions): Promise<number>;
    currentlyPlaying (): Promise<Information>;
    /** @deprecated */
    wrongSong (user: number): Promise<unknown>;
    /** @deprecated */
    currentlyPlayingData (): Promise<unknown>;
    getNormalizedPlaylist (): Promise<Video[]>;

    destroy (): void;

    get actions (): {
        [P in Action]: (...args: (string | number)[]) => Promise<Status>;
    };
    get modulePath (): "vlc-connector";
}
