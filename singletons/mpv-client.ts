import * as z from "zod";

type ConstructorOptions = {
	host: string;
	port: number;
};
type MpvResponse = {
	data: unknown;
	request_id: number;
	error: "success";
};

const dataSchemas = {
	add: z.object({ playlist_entry_id: z.int() })
};

export class MpvConnector {
	private readonly host: string;
	private readonly port: number;

	private lastStatus: unknown = null;

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

	public async add (url: string, next: boolean = false) {
		const type = (next) ? "insert-next" : "append";
		const raw = await this.send(["loadfile", url, type]);
		return dataSchemas.add.parse(raw.data);
	}

	public async skipCurrent () {
		await this.send(["playlist-next", "force"]);
	}

	public async stop () {
		await this.send(["stop", "keep-playlist"]);
	}

	public getCurrentStatus () {
		return this.lastStatus;
	}

	public async getUpdatedStatus () {
		const [position, duration] = await Promise.all([
			this.send(["get_property", "time-pos"]),
			this.send(["get_property", "duration"])
		]);

		this.lastStatus = {
			position: Math.trunc(position.data ?? 0),
			duration: Math.trunc(duration.data ?? 0)
		};

		return this.lastStatus;
	}
}
