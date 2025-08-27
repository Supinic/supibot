import config from "../config.json" with { type: "json" };
export const { prefix } = config.modules.commands;

import { randomInt as cryptoRandomInt } from "node:crypto";

import RSSParser from "rss-parser";
import { parse as chronoParse, type ParsingOption } from "chrono-node";
import { SupiError, SupiDate } from "supi-core";

import { Filter, type Type as FilterType } from "../classes/filter.js";
import type { Command, Context as CommandContext, Flag as CommandFlag } from "../classes/command.js";
import type { User } from "../classes/user.js";
import type { Channel } from "../classes/channel.js";
import type { Platform } from "../platforms/template.js";
import type { Coordinates } from "../@types/globals.js";

type CommandContextParams = CommandContext["params"];

const rssParser = new RSSParser();
const MAX_SAFE_RANGE = 281474976710655;

const PASTEBIN_EXPIRATION_OPTIONS = {
	never: "N",
	"10 minutes": "10M",
	"1 hour": "1H",
	"1 day": "1D",
	"1 week": "1W",
	"2 weeks": "2W",
	"1 month": "1M",
	"6 months": "6M",
	"1 year": "1Y"
} as const;
const PASTEBIN_PRIVACY_OPTIONS = {
	public: "0",
	unlisted: "1",
	private: "2"
} as const;

export const VIDEO_TYPE_REPLACE_PREFIX = "$";
export const TWITCH_ANTIPING_CHARACTER = "\u034F";

export const randomInt = (min: number, max: number): number => {
	if (Math.abs(min) > Number.MAX_SAFE_INTEGER || Math.abs(max) > Number.MAX_SAFE_INTEGER) {
		throw new SupiError({
			message: "Integer range exceeded",
			args: { min, max }
		});
	}

	const range = max - min;
	if (range <= MAX_SAFE_RANGE) {
		return cryptoRandomInt(min, max + 1);
	}

	const baseRoll = cryptoRandomInt(0, MAX_SAFE_RANGE);
	const multiplier = range / MAX_SAFE_RANGE;
	const roll = Math.trunc(baseRoll * multiplier);

	return (min + roll);
};

/**
 * Fetches time data for given GPS coordinates and timestamp, if provided.
 */
export const fetchTimeData = async (data: { coordinates: Coordinates, date?: SupiDate }) => {
	type LocationTimeData = {
		dstOffset: number;
		rawOffset: number;
		status: string;
		timeZoneId: string;
		timeZoneName: string;
	};

	if (!process.env.API_GOOGLE_TIMEZONE) {
		throw new SupiError({
			message: "No Google timezone API key configured (API_GOOGLE_TIMEZONE)"
		});
	}

	const {
		coordinates,
		date = new SupiDate()
	} = data;

	const response = await core.Got.get("Google")<LocationTimeData>({
		url: "timezone/json",
		searchParams: {
			timestamp: Math.trunc(date.valueOf() / 1000),
			location: `${coordinates.lat},${coordinates.lng}`,
			key: process.env.API_GOOGLE_TIMEZONE
		}
	});

	return {
		statusCode: response.statusCode,
		body: response.body
	};
};

const getFormTypes = (type: "image" | "video") => (type === "image")
	? { filename: "image.png", mime: "image/png" }
	: { filename: "video.mp4", mime: "video/mp4" };

type ImageUploadResult = {
	statusCode: number;
	link: string | null;
};
type UploadOptions = { type?: "image" | "video"; };
type SmartUploadOptions = UploadOptions & { order?: ("nuuls" | "imgur" | "kappa")[] };

/**
 * Uploads a file to {@link https://imgur.com}
 */
export const uploadToImgur = async (fileData: Buffer, options: UploadOptions = {}): Promise<ImageUploadResult> => {
	const { type = "image" } = options;
	const endpoint = (type === "image") ? "image" : "upload";
	const { filename, mime } = getFormTypes(type);

	// !!! FILE NAME MUST BE SET, OR THE API NEVER RESPONDS !!!
	const formData = new FormData();
	formData.append("image", new Blob([fileData.buffer as ArrayBuffer], { type: mime }), filename);
	formData.append("type", "image");
	formData.append("title", "Simple upload");

	type ImgurResponse = { data: { link: string; } | null; };
	const response = await core.Got.get("GenericAPI")<ImgurResponse>({
		url: `https://api.imgur.com/3/${endpoint}`,
		responseType: "json",
		method: "POST",
		throwHttpErrors: false,
		headers: {
			Authorization: "Client-ID c898c0bb848ca39"
		},
		body: formData,
		retry: {
			limit: 0
		},
		timeout: {
			request: 10_000
		}
	});

	// Weird edge case with Imgur when uploading .webm or .mkv files will leave a "." at the end of the link
	let link: string | null = response.body.data?.link ?? null;
	if (typeof link === "string" && link.endsWith(".")) {
		link = `${link}mp4`;
	}

	const statusCode: number = response.statusCode;
	return {
		statusCode,
		link
	};
};

/**
 * Uploads a file to {@link https://i.nuuls.com}
 */
export const uploadToNuuls = async (fileData: Buffer, options: UploadOptions = {}): Promise<ImageUploadResult> => {
	const { type = "image" } = options;
	const { filename, mime } = getFormTypes(type);

	const formData = new FormData();
	formData.append("file", new Blob([fileData.buffer as ArrayBuffer], { type: mime }), filename);

	const response = await core.Got.get("GenericAPI")({
		method: "POST",
		throwHttpErrors: false,
		url: "https://i.nuuls.com/upload",
		responseType: "text",
		body: formData,
		retry: {
			limit: 0
		},
		timeout: {
			request: 10_000
		}
	});

	return {
		statusCode: response.statusCode,
		link: (response.ok) ? response.body : null
	};
};

/**
 * Uploads a file to {@link https://i.nuuls.com}
 */
export const uploadToKappaLol = async (fileData: Buffer, options: UploadOptions = {}): Promise<ImageUploadResult> => {
	const { type = "image" } = options;
	const { filename, mime } = getFormTypes(type);

	const formData = new FormData();
	formData.append("file", new Blob([fileData.buffer as ArrayBuffer], { type: mime }), filename);

	const response = await core.Got.get("GenericAPI")({
		method: "POST",
		throwHttpErrors: false,
		url: "https://kappa.lol/api/upload",
		responseType: "text",
		body: formData,
		retry: {
			limit: 0
		},
		timeout: {
			request: 10_000
		}
	});

	return {
		statusCode: response.statusCode,
		link: (response.ok) ? response.body : null
	};
};

const UPLOAD_MAP = {
	imgur: uploadToImgur,
	nuuls: uploadToNuuls,
	kappa: uploadToKappaLol
} as const;
const DEFAULT_ORDER = ["nuuls", "kappa", "imgur"] as const;

export const uploadFile = async (fileData: Buffer, options: SmartUploadOptions): Promise<ImageUploadResult> => {
	const uploadOptions = { type: options.type };
	for (const item of options.order ?? DEFAULT_ORDER) {
		const result = await UPLOAD_MAP[item](fileData, uploadOptions);
		if (result.link) {
			return result;
		}
	}

	return {
		link: null,
		statusCode: 500
	};
};

/**
 * Parses an RSS string into JS object format.
 */
export const parseRSS = async (xml: string) => await rssParser.parseString(xml);

/**
 * Returns the URL's pathname + search params, if defined.
 * Returns null if it is in any way invalid.
 */
export const getPathFromURL = (stringURL: string): string | null => {
	if (!stringURL) {
		return null;
	}

	let url;
	try {
		url = new URL(stringURL);
	}
	catch {
		return null;
	}

	const path = url.pathname.replace(/^\//, "");
	return `${path}${url.search}`;
};

export const parseChrono = (string: string, referenceDate?: SupiDate, options?: ParsingOption) => {
	const chronoData = chronoParse(string, referenceDate, options);
	if (chronoData.length === 0) {
		return null;
	}

	const [chrono] = chronoData;
	return {
		date: chrono.start.date(),
		component: chrono.start,
		text: chrono.text
	};
};

type GoogleAddressComponent = {
	long_name: string;
	short_name: string;
	types: string[];
};
type GoogleCoordinates = { lat: number; lng: number; };
type GoogleGeoData = {
	address_components: GoogleAddressComponent[];
	formatted_address: string;
	geometry: {
		bounds: {
			northeast: GoogleCoordinates;
			southwest: GoogleCoordinates;
		};
		location: GoogleCoordinates;
		location_type: string;
		viewport: {
			northeast: GoogleCoordinates;
			southwest: GoogleCoordinates;
		};
	};
	place_id: string;
	types: string[]
};

/**
 * Returns Google Geo Data for given query.
 */
export const fetchGeoLocationData = async (query: string) => {
	if (!process.env.API_GOOGLE_GEOCODING) {
		throw new SupiError({
			message: "No Google geolocation API key configured (API_GOOGLE_GEOCODING)"
		});
	}

	type GeoApiResponse = {
		status: string;
		results: GoogleGeoData[];
	};

	const response = await core.Got.get("GenericAPI")<GeoApiResponse>({
		url: "https://maps.googleapis.com/maps/api/geocode/json",
		searchParams: {
			key: process.env.API_GOOGLE_GEOCODING,
			address: query
		}
	});

	if (response.body.status !== "OK") {
		return {
			success: false,
			cause: response.body.status
		} as const;
	}

	const results = response.body.results;
	const {
		address_components: components,
		formatted_address: formatted,
		place_id: placeID,
		geometry: { location }
	} = results[0];

	const object: Record<string, string> = {};
	for (const row of components) {
		let { types, long_name: long } = row;
		if (types.includes("political")) {
			types = types.filter(i => i !== "political");
			types[0] = types[0].replaceAll("_", "").replace("administrativearea", "");
			object[types[0]] = long;
		}
	}

	return {
		success: true,
		components: object,
		placeID,
		location,
		formatted
	};
};

type YoutubeThumbnail = "default" | "highres" | "medium" | "standard" | "high";
type YoutubeThumbnailDetail = {
	height: number;
	width: number;
	url: string;
}
type YoutubeSearchItem = {
	etag: string;
	id: {
		kind: string;
		videoId: string;
	};
	kind: string;
	snippet: {
		channelId: string;
		channelTitle: string;
		description: string;
		liveBroadcastContent: string;
		publishTime: string;
		publishedAt: string;
		thumbnails: Record<YoutubeThumbnail, YoutubeThumbnailDetail>;
		title: string;
	}
};
type YoutubeSearchResult = {
	etag: string;
	items: YoutubeSearchItem[];
	kind: string;
	nextPageToken: string;
	pageInfo: { totalResults: number; resultsPerPage: number; };
	regionCode: string;
};

type SearchOptions = {
	maxResults?: number;
	single?: boolean;
	filterShortsHeuristic?: boolean;
};
type SingleSearchOptions = SearchOptions & { single: true; };
type MultiSearchOptions = SearchOptions & { single?: false; };

/**
 * Fetches info about a provided YouTube video.
 */
export async function searchYoutube (query: string, options: SingleSearchOptions): Promise<{ ID: string, title: string }>;
export async function searchYoutube (query: string, options?: MultiSearchOptions): Promise<{ ID: string, title: string }[]>;
export async function searchYoutube (query: string, options: SearchOptions = {}) {
	if (!process.env.API_GOOGLE_YOUTUBE) {
		throw new SupiError({
			message: "No YouTube API key configured (API_GOOGLE_YOUTUBE)"
		});
	}

	const params = { ...options };
	if (params.single) {
		if (typeof params.maxResults !== "undefined") {
			throw new SupiError({
				message: "Cannot combine params maxResults and single"
			});
		}

		params.maxResults = 1;
	}

	const response = await core.Got.get("GenericAPI")<YoutubeSearchResult>({
		url: `https://www.googleapis.com/youtube/v3/search`,
		searchParams: {
			key: process.env.API_GOOGLE_YOUTUBE,
			q: query,
			type: "video",
			part: "snippet",
			maxResults: params.maxResults ?? "10",
			sort: "relevance"
		}
	});

	const data = response.body;
	const videoList = data.items
		.filter(i => {
			// This filtering shouldn't be necessary, but in some cases YouTube API returns playlists
			// despite the `type` parameter being set to strictly return videos only.
			if (i.id.kind !== "youtube#video" || !i.id.videoId) {
				return false;
			}
			// Heuristic shorts filtering. If the video's description is an empty string,
			// it is *likely* (not guaranteed) that the video is a short. Maybe.
			else if (options.filterShortsHeuristic && !i.snippet.description) {
				return false;
			}

			return true;
		})
		.map(i => ({
			ID: i.id.videoId,
			title: i.snippet.title
		}));

	return (params.single)
		? videoList[0] ?? null
		: videoList;
}

type YoutubePlaylistOptions = {
	playlistID: string;
	perPage?: number;
	limit?: number;
	limitAction: "trim" | "return" | "error";
};
type YoutubePlaylistSearchParams = {
	part: "snippet",
	key: string;
	maxResults: number;
	playlistId: string;
	pageToken?: string;
};
type YoutubePlaylistItem = {
	etag: string;
	id: string;
	kind: "youtube#playlistItem";
	snippet: {
		channelId: string;
		channelTitle: string;
		description: string;
		playlistId: string;
		position: number;
		publishedAt: string;
		resourceId: {
			kind: "youtube#video";
			videoId: string;
		};
		thumbnails: Record<YoutubeThumbnail, YoutubeThumbnailDetail>;
		title: string;
		videoOwnerChannelId: string;
		videoOwnerChannelTitle: string;
	}
};
type YoutubePlaylistData = {
	etag: string;
	kind: "youtube#playlistItemListResponse";
	items: YoutubePlaylistItem[];
	nextPageToken: string;
	pageInfo: {
		totalResults: number;
		resultsPerPage: number;
	}
};
type YoutubePlaylistResult = {
	ID: YoutubePlaylistItem["snippet"]["resourceId"]["videoId"];
	title: YoutubePlaylistItem["snippet"]["title"];
	channelTitle: YoutubePlaylistItem["snippet"]["channelTitle"];
	published: SupiDate;
	position: YoutubePlaylistItem["snippet"]["position"];
};
type YoutubePlaylistErrorResult = {
	success: false,
	reason: "limit-exceeded" | "not-found";
	limit?: number;
	amount?: number;
};
type YoutubePlaylistSuccessResult = {
	success: true,
	reason?: "limit-exceeded";
	amount?: number;
	result: YoutubePlaylistResult[];
};

/**
 * Fetches a YouTube playlist as an array of video IDs.
 * Optionally, limits the amount of videos fetched.
 */
export const fetchYoutubePlaylist = async (options: YoutubePlaylistOptions): Promise<YoutubePlaylistSuccessResult | YoutubePlaylistErrorResult> => {
	if (!process.env.API_GOOGLE_YOUTUBE) {
		throw new SupiError({
			message: "No YouTube API key configured (API_GOOGLE_YOUTUBE)"
		});
	}

	const limit = options.limit ?? Infinity;
	const baseParams = {
		part: "snippet",
		key: process.env.API_GOOGLE_YOUTUBE,
		maxResults: options.perPage ?? 50,
		playlistId: options.playlistID
	} as const;

	let pageToken = null;
	const result = [];
	do {
		const searchParams: YoutubePlaylistSearchParams = { ...baseParams };
		if (pageToken) {
			searchParams.pageToken = pageToken;
		}

		const response = await core.Got.get("GenericAPI")({
			url: "https://www.googleapis.com/youtube/v3/playlistItems",
			searchParams,
			throwHttpErrors: false,
			responseType: "json"
		});

		if (response.statusCode !== 200) {
			return {
				success: false,
				reason: "not-found"
			};
		}

		const data = response.body as YoutubePlaylistData;
		pageToken = data.nextPageToken;

		result.push(...data.items.map(i => ({
			ID: i.snippet.resourceId.videoId,
			title: i.snippet.title,
			channelTitle: i.snippet.channelTitle,
			published: new SupiDate(i.snippet.publishedAt),
			position: i.snippet.position
		})));

		if (options.limitAction === "trim" && result.length > limit) {
			return {
				success: true,
				result: result.slice(0, limit)
			};
		}
		else if (data.pageInfo.totalResults > limit) {
			if (options.limitAction === "error") {
				throw new SupiError({
					message: "Maximum amount of videos exceeded!",
					args: {
						limit,
						amount: data.pageInfo.totalResults
					}
				});
			}
			else if (options.limitAction === "return") {
				return {
					success: false,
					reason: "limit-exceeded",
					limit,
					amount: data.pageInfo.totalResults
				};
			}
			else {
				return {
					success: true,
					reason: "limit-exceeded",
					amount: data.pageInfo.totalResults,
					result
				};
			}
		}
	} while (pageToken);

	return {
		success: true,
		result
	};
};

type TwitchGameDetail = {
	box_art_url: string;
	id: string;
	igdb_id: string;
	name: string;
};

/**
 * Returns the Twitch game ID for the given game name.
 */
export const getTwitchGameID = async (name: string): Promise<{ name: string; id: string; }[]> => {
	const response = await core.Got.get("Helix")<{ data: TwitchGameDetail[]; }>({
		url: "games",
		searchParams: { name }
	});

	const { data } = response.body;
	if (!response.ok || data.length === 0) {
		return [];
	}

	return data.map(i => ({
		id: i.id,
		name: i.name
	}));
};

export type ParsedGenericFilterData = {
	command: Command["Name"] | null;
	channel: Channel["ID"] | null;
	platform: Platform["ID"] | null;
	user?: User["ID"] | null;
	invocation: string | null;
};
type ParsedGenericFilterOptions = {
	argsOrder: string[];
	includeUser?: boolean;
	requiredCommandFlag?: CommandFlag;
	requiredCommandFlagResponse?: string;
};
type ParsedGenericFilterResponse =
	{ success: false; reply: string; }
	| { success: true; filter: Filter; }
	| { success: true; filter: ParsedGenericFilterData; };

/**
 * Standard parser function for all Filter-related commands.
 * Grabs platform. channel, command (additionally user too) from the context.params object
 * and also returns parse failures if encountered.
 */
export const parseGenericFilterOptions = async (
	type: string,
	params: CommandContextParams,
	args: string[],
	options: ParsedGenericFilterOptions
): Promise<ParsedGenericFilterResponse> => {
	if (typeof params.id === "number") {
		const filter = sb.Filter.get(params.id);
		if (!filter) {
			return {
				success: false,
				reply: `There is no filter with ID ${params.id}!`
			};
		}
		else if (filter.Type !== type) {
			return {
				success: false,
				reply: `Invalid filter type provided! Re-check the filter ID.`
			};
		}

		return {
			success: true,
			filter
		};
	}

	const filterData: ParsedGenericFilterData = {
		command: null,
		channel: null,
		platform: null,
		invocation: null
	};

	const commandArgId = options.argsOrder.indexOf("command");
	const commandName = params.command ?? args[commandArgId];

	if (!commandName || typeof commandName !== "string") {
		return {
			success: false,
			reply: `A command (or "all" to optout globally) must be provided!`
		};
	}

	if (commandName === "all") {
		filterData.command = null;
	}
	else {
		const commandData = sb.Command.get(commandName);
		if (!commandData) {
			return {
				success: false,
				reply: `Command ${commandName} does not exist!`
			};
		}
		if (options.requiredCommandFlag && options.requiredCommandFlagResponse && !commandData.Flags.includes(options.requiredCommandFlag)) {
			return {
				success: false,
				reply: options.requiredCommandFlagResponse
			};
		}

		filterData.command = commandData.Name;

		// Apply a "heuristic" - if user provided an alias to a command, automatically assume
		// it's the base command + the alias as invocation
		if (commandData.Name !== commandName) {
			filterData.invocation = commandName;
		}
	}

	if (params.channel && params.platform) {
		return {
			success: false,
			reply: "Cannot specify both the channel and platform!"
		};
	}

	if (typeof params.channel === "string") {
		const channelData = sb.Channel.get(params.channel);
		if (!channelData) {
			return {
				success: false,
				reply: `Channel ${params.channel} does not exist!`
			};
		}

		filterData.channel = channelData.ID;
	}

	if (typeof params.platform === "string") {
		const platformData = sb.Platform.get(params.platform);
		if (!platformData) {
			return {
				success: false,
				reply: `Platform ${params.platform} does not exist!`
			};
		}

		filterData.platform = platformData.ID;
	}

	if (options.includeUser) {
		filterData.user = null;

		const userArgId = options.argsOrder.indexOf("user");
		const userName = (params.user as string | undefined) ?? args[userArgId];

		if (userName) {
			const userData = await sb.User.get(userName);
			if (!userData) {
				return {
					success: false,
					reply: `User ${userName} does not exist!`
				};
			}

			filterData.user = userData.ID;
		}
	}

	return {
		success: true,
		filter: filterData
	};
};

type BaseFilterData = {
	enableInvocation: string;
	disableInvocation: string;
	enableVerb: string;
	disableVerb: string;
	context: CommandContext;
};
type FilterFilledGenericData = BaseFilterData & {
	filter: Filter;
	filterData: null;
};
type FilterDataFilledGenericData = BaseFilterData & {
	filter: null;
	filterData: Partial<ParsedGenericFilterData>;
};
type GenericFilterData = FilterFilledGenericData | FilterDataFilledGenericData;

export const handleGenericFilter = async (type: FilterType, data: GenericFilterData): Promise<{ reply: string; success: boolean }> => {
	const {
		filter,
		enableInvocation,
		disableInvocation,
		enableVerb,
		disableVerb,
		context,
		filterData
	} = data;

	let replyFn: (commandString: string, filter: Filter) => string;
	const { invocation } = context;
	const params = context.params;

	const verb = (invocation === enableInvocation) ? enableVerb : disableVerb;

	let resultFilter: Filter;
	if (filter) {
		if (filter.Issued_By !== context.user.ID) {
			return {
				success: false,
				reply: `You can't edit this filter - you didn't create it!`
			};
		}

		if ((filter.Active && invocation === enableInvocation) || (!filter.Active && invocation === disableInvocation)) {
			const state = (invocation === enableInvocation) ? "enabled" : "disabled";
			return {
				success: false,
				reply: (typeof params.id === "number")
					? `Your filter ID ${params.id} is already ${state}!`
					: `This combination is already ${state}!`
			};
		}

		await filter.toggle();

		resultFilter = filter;
		replyFn = (commandString: string, filter: Filter) => `Successfully ${verb} ${commandString} (ID ${filter.ID}).`;
	}
	else {
		if (invocation === disableInvocation) {
			return {
				success: false,
				reply: `You have not ${enableVerb} this combination before, so you can't ${invocation} just yet!`
			};
		}

		resultFilter = await Filter.create({
			Type: type,
			User_Alias: context.user.ID,
			Issued_By: context.user.ID,
			Command: filterData.command,
			Channel: filterData.channel,
			Platform: filterData.platform,
			Invocation: filterData.invocation,
			Blocked_User: filterData.user ?? null
		});

		let location = "";
		if (typeof params.channel === "string") {
			location = ` in channel ${params.channel}`;
		}
		else if (typeof params.platform === "string") {
			location = ` in platform ${params.platform}`;
		}

		replyFn = (commandString: string, filter: Filter) => `Successfully ${verb} ${commandString} ${location} (ID ${filter.ID}).`;
	}

	let commandString;
	const prefix = sb.Command.prefix;
	if (resultFilter.Command === null) {
		commandString = `all valid commands`;
	}
	else if (resultFilter.Invocation !== null) {
		commandString = `command ${prefix}${resultFilter.Command} (alias ${prefix}${resultFilter.Invocation})`;
	}
	else {
		commandString = `command ${prefix}${resultFilter.Command}`;
	}

	const reply = replyFn(commandString, resultFilter);
	return {
		success: true,
		reply
	};
};

type PastebinPostOptions = {
	name?: string;
	privacy?: keyof typeof PASTEBIN_PRIVACY_OPTIONS;
	expiration?: keyof typeof PASTEBIN_EXPIRATION_OPTIONS;
	format?: string;
};

type TextPostGenericResult = {
	ok: boolean;
	statusCode: number;
};
type TextPostResultSuccess = TextPostGenericResult & {
	ok: true;
	link: string;
	reason: null;
};
type TextPostResultFailure = TextPostGenericResult & {
	ok: false;
	link: null;
	reason: string;
};
type TextPostResult = TextPostResultFailure | TextPostResultSuccess;

/**
 * Posts the provided text to Pastebin, creating a new "paste".
 */
export const postToPastebin = async (text: string, options: PastebinPostOptions = {}): Promise<TextPostResult> => {
	if (!process.env.API_PASTEBIN) {
		throw new SupiError({
			message: "Cannot upload to Pastebin - missing env variable API_PASTEBIN"
		});
	}

	const params = new URLSearchParams({
		api_dev_key: process.env.API_PASTEBIN,
		api_option: "paste",
		api_paste_code: text,
		api_paste_name: options.name || "untitled Supibot paste",
		api_paste_private: (options.privacy) ? PASTEBIN_PRIVACY_OPTIONS[options.privacy] : "1",
		api_paste_expire_date: (options.expiration) ? PASTEBIN_EXPIRATION_OPTIONS[options.expiration] : "10M"
	});

	if (options.format) {
		params.append("api_paste_format", options.format);
	}

	const response = await core.Got.get("GenericAPI")({
		method: "POST",
		url: "https://pastebin.com/api/api_post.php",
		throwHttpErrors: false,
		responseType: "text",
		body: params.toString(),
		headers: {
			"Content-Type": "application/x-www-form-urlencoded"
		},
		timeout: {
			request: 5000
		}
	});

	if (!response.ok) {
		return {
			ok: response.ok,
			statusCode: response.statusCode,
			link: null,
			reason: (response.statusCode === 422) ? response.body : "Could not create a Pastebin paste!"
		};
	}
	else {
		return {
			ok: response.ok,
			statusCode: response.statusCode,
			link: response.body,
			reason: null
		};
	}
};

/**
 * Posts the provided text to Hastebin, creating a new "paste".
 */
export const postToHastebin = async (text: string, options: { title?: string } = {}): Promise<TextPostResult> => {
	if (options.title) {
		text = `${options.title}\n\n${text}`;
	}

	type HastebinApiResponse = { key: string; };
	const response = await core.Got.get("GenericAPI")<HastebinApiResponse>({
		method: "POST",
		url: "https://haste.zneix.eu/documents",
		throwHttpErrors: false,
		body: text
	});

	if (!response.ok) {
		return {
			ok: response.ok,
			statusCode: response.statusCode,
			reason: "Could not create a Hastebin paste!",
			link: null
		};
	}
	else {
		return {
			ok: response.ok,
			statusCode: response.statusCode,
			link: `https://haste.zneix.eu/raw/${response.body.key}`,
			reason: null
		};
	}
};
