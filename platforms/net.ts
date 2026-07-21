import * as z from "zod";
import { SupiError } from "supi-core";
import { createServer, type Server, type Socket } from "node:net";
import { createInterface, type Interface } from "node:readline";

import { BasePlatformConfigSchema } from "./schema.js";
import { Platform } from "./template.js";
import type { User } from "../classes/user.js";

const NetConfigSchema = BasePlatformConfigSchema.extend({
	platform: z.object({
		verbose: z.boolean(),
		port: z.number()
	})
});

export type NetConfig = z.infer<typeof NetConfigSchema>;
type NetClient = {
	socket: Socket;
	rl: Interface;
};

const readSingleLine = (socket: Socket, rl: Interface): Promise<string | null> => new Promise((resolve) => {
	rl.once("line", (line) => resolve(line));
	socket.once("end", () => resolve(null));
	socket.once("error", () => resolve(null));
});
const exitCommands = new Set(["exit", "quit"]);

export class NetPlatform extends Platform<NetConfig> {
	private server: Server | null = null;
	private clients = new Map<User, NetClient>();
	public readonly debug = true;

	constructor (config: NetConfig) {
		super("net", NetConfigSchema.parse(config));
	}

	connect () {
		if (this.server) {
			return Promise.resolve();
		}

		const server = createServer((socket) => {
			if (this.config.verbose) {
				socket.on("close", () => console.log("[net] client closed"));
				socket.on("error", (err) => console.error("[net] client error", err));
			}

			void this.handleConnection(socket);
		});

		server.on("error", (err) => console.warn(err));
		server.listen(this.config.port, "0.0.0.0", () => {
			console.log("Net platform is listening");
		});

		if (this.config.verbose) {
			server.on("listening", () => console.log("[net] listening"));
		}

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

		if (exitCommands.has(message.toLowerCase().trim())) {
			this.write("Bye", userData);
			this.removeUser(userData);
			return;
		}

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
			console.warn("Net platform has no client available to send to", { message, user: user.ID });
			return;
		}

		this.writeToSocket(client.socket, message);
	}

	private writeToSocket (socket: Socket, message: string) {
		socket.write(`< ${message}\n> `);
	}

	private async handleConnection (socket: Socket) {
		socket.setEncoding("utf8");
		socket.setNoDelay(true);
		socket.setKeepAlive(true);
		socket.unref();

		const rl = createInterface({
			input: socket,
			output: socket,
			terminal: false,
			crlfDelay: Infinity
		});

		let user: User | undefined;
		if (process.env.DEBUG_NET_EDIT_USER) {
			this.writeToSocket(socket, "Connected. Select an existing username or type a new one to be created. Use '<username> admin' to create the user as administrator");
			this.writeToSocket(socket, "If you want to disable this and only use existing usernames, unset the env variable 'DEBUG_NET_EDIT_USER'");

			const response = await readSingleLine(socket, rl);
			if (!response) {
				this.writeToSocket(socket, "No response received, quitting");
				return;
			}

			const [username, possibleAdmin] = response.trim().split(" ", 3);
			const possibleUser = await sb.User.get(username, false);
			if (!possibleUser) {
				throw new SupiError({
					message: "Assert error: No user found nor created"
				});
			}

			user = possibleUser;
			if (possibleAdmin === "admin") {
				await user.setDataProperty("administrator", true);
			}
		}
		else {
			this.writeToSocket(socket, "Connected. Select an existing username");

			while (!user) {
				const response = await readSingleLine(socket, rl);
				if (!response) {
					this.writeToSocket(socket, "No response received, quitting");
					return;
				}

				const possibleUser = await sb.User.get(response.toLowerCase());
				if (!possibleUser) {
					this.writeToSocket(socket, "Unknown username provided, try again");
				}
				else {
					user = possibleUser;
				}
			}
		}

		this.writeToSocket(socket, "Initialized, waiting for commands. Use 'exit' or 'quit' to terminate the session");
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

		if (!client.socket.closed) {
			client.socket.destroySoon();
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
