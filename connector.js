const Redis = require("ioredis");
const EventEmitter = require("events");

const CONNECTOR_REDIS_DB_ID = 1;
const CONNECTOR_INTERVAL_TIMEOUT = 250;
const CONNECTOR_STREAM_KEY = "supibot-stream";

class Connector extends EventEmitter {
	#config;
	#server;
	#initialConnectSuccess = false;
	#lastId = "$";
	#active = false;
	#intervalTimeout = CONNECTOR_INTERVAL_TIMEOUT;

	constructor (config) {
		super();
		this.#config = config;
	}

	async connect () {
		this.#server = new Redis({
			...this.#config,
			db: CONNECTOR_REDIS_DB_ID,
			retryStrategy: (times) => {
				// Initial connect failure - just stop
				if (this.#initialConnectSuccess === false) {
					throw new sb.Error({
						message: "Cannot establish initial connection to Redis",
						args: {
							configuration: this.#config
						}
					});
				}

				console.warn(`Redis disconnected, reconnecting in ${times} seconds...`);
				return (1000 * times);
			}
		});

		await this.#server.info();
		this.#initialConnectSuccess = true;

		await this.#process();
	}

	startListening () {
		this.#active = true;
	}

	stopListening () {
		this.#active = false;
	}

	async #process () {
		if (this.#active) {
			const responses = await this.#server.xread("BLOCK", 0, "STREAMS", CONNECTOR_STREAM_KEY, this.#lastId);
			for (const response of responses) {
				const [streamKey, results] = response;
				if (streamKey !== CONNECTOR_STREAM_KEY) { // Should never happen
					continue;
				}

				for (const result of results) {
					const [id, messageData] = result;
					const [key, value] = messageData;

					let data;
					try {
						data = JSON.parse(value);
					}
					catch (e) {
						console.warn("Invalid JSON received", { data });
						continue;
					}

					this.emit("message", { key, data });
					this.#lastId = id;
				}
			}
		}

		setImmediate(() => this.#process());
	}

	get lastId () { return this.#lastId; }
}

module.exports = Connector;
