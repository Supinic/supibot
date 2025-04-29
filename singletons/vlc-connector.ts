import VLCClient from "./vlc-client.js";

// @deprecated move to vlc-client.ts
import type { Information, Node, Root, Status } from "../@types/singletons/vlc-client.d.ts";

import getLinkParser from "../utils/link-parser.js";
import cacheKeys from "../utils/shared-cache-keys.json" with { type: "json" };


const { SONG_REQUESTS_VLC_PAUSED } = cacheKeys;

type ConstructorOptions = {
	url: string;
	baseURL: string;
	port: number;
	username: string;
	password: string;
};
type CommandOptions = Record<string, string>;
type SomeResult = Record<string, string>;

/**
 * VideoLANConnector (VLC) handler module - handles a VLC instance's playlist and methods.
 */
