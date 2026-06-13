import * as z from "zod";
import { SupiError } from "supi-core";
import { createServer, type Server, type Socket } from "node:net";
import { createInterface, type Interface } from "node:readline";

import { BasePlatformConfigSchema } from "./schema.js";
import { Platform } from "./template.js";
import type { User } from "../classes/user.js";

const NetConfigSchema = BasePlatformConfigSchema.extend({
	platform: z.object({ port: z.number() })
});
const NET_HOST = "localhost";

export type NetConfig = z.infer<typeof NetConfigSchema>;
type NetClient = {
	socket: Socket;
	rl: Interface;
};

const readSingleLine = (socket: Socket, rl: Interface): Promise<string | null> => new Promise((resolve) => {
	const cleanup = () => {
		rl.removeAllListeners();
		rl.close();
	};

	rl.once("line", (line) => {
		cleanup();
		resolve(line);
	});

	socket.once("end", () => {
		cleanup();
		resolve(null);
	});

	socket.once("error", () => {
		cleanup();
		resolve(null);
	});
});

export class NetPlatform extends Platform<NetConfig> {
	private server: Server | null = null;
	private clients = new Map<User, NetClient>();

	constructor (config: NetConfig) {
		super("net", NetConfigSchema.parse(config));
	}

	connect () {
		if (this.server) {
			return Promise.resolve();
		}

		const server = createServer((socket) => void this.handleConnection(socket));
		server.once("error", (err) => {
			console.warn(err);
		});
		server.listen(this.config.port, NET_HOST, () => {
			console.log("Net platform is listening");
		});

		this.server = server;
		return Promise.resolve();
	}

	pm (message: string, userData: User) {
		this.write(message, userData);
		return Promise.resolve();
	}

	async handleMessage (message: string, userData: User) {
		this.incrementMessageMetric("read", null);
		this.resolveUserMessage(null, userData, message);

		if (!sb.Command.is(message)) {
			this.write("No valid command provided", userData);
			return;
		}

		const [command, ...args] = message
			.trim()
			.replace(sb.Command.prefix, "")
			.split(/\s+/)
			.filter(Boolean);

		const result = await sb.Command.checkAndExecute({
			command,
			args,
			user: userData,
			channel: null,
			platform: this,
			options: { privateMessage: true },
			platformSpecificData: null
		});

		if (result.reply) {
			const commandOptions = sb.Command.extractMetaResultProperties(result);
			const reply = await this.prepareMessage(result.reply, null, {
				...commandOptions,
				skipBanphrases: true,
				skipLengthCheck: true
			});

			if (reply) {
				this.write(reply, userData);
			}
		}
	}

	private write (message: string, user: User) {
		const client = this.clients.get(user);
		if (!client) {
			throw new SupiError({
				message: "Net platform has no client available to send to"
			});
		}

		client.socket.write(message);
	}

	private async handleConnection (socket: Socket) {
		socket.setEncoding("utf8");
		socket.setNoDelay(true);
		socket.setKeepAlive(true);

		const rl = createInterface({
			input: socket,
			output: socket,
			terminal: false,
			crlfDelay: Infinity
		});

		socket.write("Connected, select a username");

		let user: User | undefined;
		while (!user) {
			const response = await readSingleLine(socket, rl);
			if (!response) {
				socket.write("No response received, quitting");
				return;
			}

			const possibleUser = await sb.User.get(response.toLowerCase());
			if (!possibleUser) {
				socket.write("Unknown user provided, try again");
			}
			else {
				user = possibleUser;
			}
		}

		socket.write("Initialized");
		const client = { rl, socket };
		this.clients.set(user, client);

		rl.on("line", (line) => void this.handleMessage(line, user));
		socket.on("close", () => this.removeUser(user));
		socket.on("error", () => this.removeUser(user));
	}

	private removeUser (user: User) {
		const client = this.clients.get(user);
		if (!client) {
			return;
		}

		client.rl.close();
		this.clients.delete(user);
	}

	initListeners () {}
	isUserChannelOwner () { return null; }
	populateUserList () { return []; }
	populateGlobalEmotes () { return []; }
	fetchChannelEmotes () { return []; }
	isChannelLive () { return null; }
	createUserMention (userData: User) { return Promise.resolve(userData.Name); }

	send (): never {
		throw new SupiError({
			message: "Net platform does not support channel messaging"
		});
	}

	fetchInternalPlatformIDByUsername (): never {
		throw new SupiError({
			message: "Net platform does not support user platform ID lookup by username"
		});
	}

	fetchUsernameByUserPlatformID (): never {
		throw new SupiError({
			message: "Net platform does not support username lookup by user platform ID"
		});
	}
}

export default NetPlatform;
