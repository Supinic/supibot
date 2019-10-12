module.exports = (function () {
	const EventEmitter = require("events");
	const SocketIO = require("socket.io-client");
	const request = require("request"); // @todo swap to request-promise and promisify the callbacks

	const defaultConfig = {
		secure : true,
		host : "cytu.be",
		port : "443",
		chan : "test",
		pass : null,
		user : "Test-" + Math.random().toString(16).slice(-8),
		auth : null,
		agent : "CyTube Client 0.4",
		debug : (process.env.NODE_ENV !== "production"),
		socketURL : null,
		cooldown: {},
		socket: null
	};
	const handlers = [ "disconnect",
		/*
		 These are from CyTube /src/user.js
		 */
		"announcement",
		"clearVoteskipVote",
		"kick",
		"login",
		"setAFK",

		/*
		 Current list as of 2017-06-04
		 The following command was used to get this list from CyTube /src/channel/
		 $> ( spot emit && spot broadcastAll ) \
		 | awk {"print $2"} | sed "s/"/\n"/g" \
		 | grep """ | grep -Pi "[a-z]" | sort -u
		 */
		"addFilterSuccess",
		"addUser",
		"banlist",
		"banlistRemove",
		"cancelNeedPassword",
		"changeMedia",
		"channelCSSJS",
		"channelNotRegistered",
		"channelOpts",
		"channelRankFail",
		"channelRanks",
		"chatFilters",
		"chatMsg",
		"clearchat",
		"clearFlag",
		"closePoll",
		"cooldown",
		"costanza",
		"delete",
		"deleteChatFilter",
		"drinkCount",
		"emoteList",
		"empty",
		"errorMsg",
		"listPlaylists",
		"loadFail",
		"mediaUpdate",
		"moveVideo",
		"needPassword",
		"newPoll",
		"noflood",
		"playlist",
		"pm",
		"queue",
		"queueFail",
		"queueWarn",
		"rank",
		"readChanLog",
		"removeEmote",
		"renameEmote",
		"searchResults",
		"setCurrent",
		"setFlag",
		"setLeader",
		"setMotd",
		"setPermissions",
		"setPlaylistLocked",
		"setPlaylistMeta",
		"setTemp",
		"setUserMeta",
		"setUserProfile",
		"setUserRank",
		"spamFiltered",
		"updateChatFilter",
		"updateEmote",
		"updatePoll",
		"usercount",
		"userLeave",
		"userlist",
		"validationError",
		"validationPassed",
		"voteskip",
		"warnLargeChandump",
	];

	class CytubeConnector extends EventEmitter {
		constructor (options) {
			super();
			Object.assign(this, defaultConfig, options);

			this.once("ready", () => {
				this.connect();
				this.emit("clientinit");
				})
				.once("connected", () => {
					this.start();
					this.emit("clientready");
				})
				.once("started", () => {
					if (typeof this.assignLateHandlers === "function") {
						this.assignLateHandlers();
					}
				});

			this.getSocketURL();
		}

		getSocketURL () {
			const options = {
				url: this.configURL,
				headers: {
					"User-Agent": this.agent
				},
				timeout: 20e3
			};

			request(options, (err, resp, body) => {
				if (err) {
					this.emit("error", new Error("Socket lookup failure", err));
					return;
				}

				if (resp.statusCode !== 200) {
					this.emit("error", new Error("Socket lookup failure", resp.statusCode));
					return;
				}

				let data = null;
				try {
					data = JSON.parse(body);
				}
				catch (e) {
					this.emit("error", new Error("Malformed JSON response", e));
					return;
				}

				let servers = [...data.servers];
				while (servers.length) {
					const server = servers.pop();
					if (server.secure === this.secure && typeof server.ipv6 === "undefined") {
						this.socketURL = server.url;
					}
				}

				if (!this.socketURL) {
					this.emit("error", new Error("No suitable socket available"));
					return;
				}

				// this.console.log("Socket server url retrieved:", this.socketURL);
				this.emit("ready");
			});
		}

		connect () {
			if (this.socket) {
				this.socket.close();
				this.socket = null;
			}

			this.emit("connecting");
			this.socket = SocketIO(this.socketURL)
				.on("error", (err) => this.emit("error", new Error(err)))
				.once("connect", () => {
					if (!this.handlersAssigned) {
						this.assignHandlers();
						this.handlersAssigned = true;
					}
					this.connected = true;
					this.emit("connected");
				});

			return this;
		}

		start () {
			// this.console.log("Connecting to channel.");
			this.socket.emit("joinChannel", { name: this.chan });
			this.emit("starting");

			this.socket.once("needPassword", () => {
				if (typeof this.pass !== "string") {
					this.emit("error", new Error("Channel requires password"));
					return;
				}
				this.socket.emit("channelPassword", this.pass);
			});

			this.killswitch = setTimeout(() => {
				this.emit("error", new Error("Channel connection failure - no response within 60 seconds"));
			}, 60e3);

			this.socket.once("login", (data) => {
				if (typeof data === "undefined") {
					this.emit("error", new Error("Malformed login frame recieved"));
					return;
				}

				if (!data.success) {
					this.emit("error", new Error("Channel login failure", JSON.stringify(data)));
				}
				else {
					// this.console.log("Channel connection established.");
					this.emit("started");

					clearTimeout(this.killswitch);
					this.killswitch = null;
				}
			});

			this.socket.once("rank", () => {
				this.socket.emit("login", {
					name: this.user,
					pw: this.auth
				});
			});

			return this;
		}

		assignHandlers () {
			// this.console.log("Assigning event handlers.");

			handlers.forEach(frame => {
				this.socket.on(frame, (...args) => {
					this.emit(frame, ...args);
				});
			});
		}

		destroy () {
			if (this.socket) {
				this.socket.disconnect(0);
			}
		}

		get configURL () {
			return `${this.secure ? "https" : "http"}://${this.host}:${this.port}/socketconfig/${this.chan}.json`;
		}
	}

	Object.assign(CytubeConnector.prototype, {
		// Messages
		chat: function (chatMsg) {
			this.socket.emit("chatMsg", chatMsg);
		},
		pm: function (privMsg) {
			this.socket.emit("pm", privMsg);
		},

		// Polls
		createPoll: function (poll) {
			this.socket.emit("newPoll", poll);
		},
		closePoll: function () {
			this.socket.emit("closePoll");
		},

		// Channel Control
		sendOptions: function (opts) {
			this.socket.emit("setOptions", opts);
		},
		sendPermissions: function (perms) {
			this.socket.emit("setPermissions", perms);
		},
		sendBanner: function (banner) {
			this.socket.emit("setMotd", banner);
		},

		// Bans
		bans: function () {
			this.socket.emit("requestBanlist");
		},
		unban: function (ban) {
			this.socket.emit("unban", ban);
		},

		// Media Control
		leader: function (leader) {
			this.socket.emit("assignLeader", leader);
		},
		deleteVideo: function (uid) {
			this.socket.emit("delete", uid);
		},
		move: function (pos) {
			this.socket.emit("moveMedia", pos);
		},
		jump: function (uid) {
			this.socket.emit("jumpTo", uid);
		},
		shuffle: function () {
			this.socket.emit("shufflePlaylist");
		},
		playlist: function () {
			this.socket.emit("requestPlaylist");
		}
	});

	return CytubeConnector;
})();