type Information = {
	chapter: number;
	chapters: number[];
	title: number;
	category: Category;
	titles: number[];
};
type Category = {
	meta: Meta;
	[P: string]: { [key: string]: string } | Meta;
};
type AudioFilters = {
	[filter: string]: string;
};
type Meta = {
	url?: string;
	encoded_by: string;
	filename: string;
};
type VideoEffects = {
	hue: number;
	saturation: number;
	contrast: number;
	brightness: number;
	gamma: number;
};

type Stats = { [key: string]: number };
type State = "paused" | "playing" | "stopped";
type AspectRatio = "1:1" | "4:3" | "5:4" | "16:9" | "16:10" | "221:100" | "235:100" | "239:100";

type StatusBase = {
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
	audiofilters: AudioFilters;
	rate: number;
	videoeffects: VideoEffects;
	state: State;
	loop: boolean;
	version: string;
	position: number;
	information: Information;
	repeat: boolean;
	subtitledelay: number;
	equalizer: unknown[];
};
type StatusPaused = StatusBase & {
	stats: Stats;
	aspectratio: AspectRatio;
	state: "paused";
};
type StatusPlaying = StatusBase & {
	stats: Stats;
	aspectratio: AspectRatio;
	state: "playing";
};
type StatusStopped = StatusBase & {
	stats: null;
	aspectratio: null;
	state: "stopped";
};
export type VlcStatus = StatusPaused | StatusPlaying | StatusStopped;

export type VlcPlaylistNode = {
	id: string;
	name: string;
	ro: "rw" | "ro";
	current?: string;
	duration?: number;
	type?: "node" | "leaf";
	uri?: string;
	children?: VlcPlaylistNode[];
};
export type VlcPlaylistRoot = VlcPlaylistNode & {
	children: VlcPlaylistNode[];
	name: "Playlist";
	type: "node";
	ro: "ro";
}
export type VlcTopPlaylist = VlcPlaylistRoot & {
	children: [
			VlcPlaylistRoot & { name: "Playlist"; },
			VlcPlaylistRoot & { name: "Media library"; }
	];
};
