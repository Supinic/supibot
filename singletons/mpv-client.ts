import * as z from "zod";
import { SupiError } from "supi-core";

type ConstructorOptions = {
	host: string;
	port: number;
};
type MpvResponse = {
	data: unknown;
	request_id: number;
	error: "success" | "property unavailable";
};
type MpvStatus = {
	playlistCount: number;
	position: number | null;
	duration: number | null;
};

const PROPERTY_NA = "property unavailable";
const dataSchemas = {
	add: z.object({ playlist_entry_id: z.int() }),
	duration: z.int(),
	position: z.int(),
	playlistCount: z.int()
};

export class MpvConnector {
	private readonly host: string;
	private readonly port: number;

	private lastStatus: MpvStatus | null = null;

	public constructor (options: ConstructorOptions) {
		this.host = options.host;
		this.port = options.port;
	}

	private async send (command: unknown[]) {
		const url = new URL(`${this.host}:${this.port}/`);
		url.searchParams.set("mpv", JSON.stringify(command));

		const response = await fetch(url);
		const data: unknown = await response.json();

		return data as MpvResponse; // @todo proper type checking (zod)
	}

	public async add (url: string) {
		const { playlistCount } = await this.getUpdatedStatus();
		const type = (playlistCount === 0) ? "append-play" : "append";

		const raw = await this.send(["loadfile", url, type]);
		return dataSchemas.add.parse(raw.data);
	}

	public async skipCurrent () {
		await this.send(["playlist-next", "force"]);
	}

	public async stop () {
		await this.send(["stop", "keep-playlist"]);
	}

	public getCurrentStatus (): MpvStatus {
		if (!this.lastStatus) {
			throw new SupiError({
				message: "Assert error: Attempt to fetch mpv status before initialization"
			});
		}

		return this.lastStatus;
	}

	public async getUpdatedStatus (): Promise<MpvStatus> {
		const [rawPosition, rawDuration, rawPlaylistCount] = await Promise.all([
			this.send(["get_property", "time-pos"]),
			this.send(["get_property", "duration"]),
			this.send(["get_property", "playlist-count"])
		]);

		const position = (rawPosition.error === PROPERTY_NA) ? null : dataSchemas.position.parse(rawPosition.data);
		const duration = (rawPosition.error === PROPERTY_NA) ? null : dataSchemas.duration.parse(rawDuration.data);
		const playlistCount = dataSchemas.playlistCount.parse(rawPlaylistCount.data);

		this.lastStatus = { position, duration, playlistCount };
		return this.lastStatus;
	}
}
