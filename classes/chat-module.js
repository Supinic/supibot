module.exports = (function () {
	"use strict";

	return class ChatModule {
		ID;
		Name;
		Events;
		Active = true;
		Code;
		attachmentReferences = [];
		data = {};

		static data = [];

		constructor (data) {
			this.ID = (typeof data.ID === "number")
				? data.ID
				: Symbol();

			this.Name = data.Name;

			try {
				this.Events = JSON.parse(data.Events);
				if (!Array.isArray(this.Events)) {
					console.warn("Chat module - events are not Array", e);
					this.Events = [];
				}
			}
			catch (e) {
				console.warn("Chat module - events parse failed", e);
				this.Events = [];
			}

			if (typeof data.Active === "boolean") {
				this.Active = data.Active;
			}

			let fn = null;
			try {
				fn = eval(data.Code);
			}
			catch (e) {
				console.warn("Chat module - code parse failed", e);
				fn = () => undefined;
			}

			this.Code = fn.bind(this);
		}

		attach (options) {
			for (const event of this.Events) {
				for (const channelData of ChatModule.getTargets(options)) {
					const listener = (context) => this.Code(context, ...options.args);
					channelData.events.on(event, listener);

					this.attachmentReferences.push({
						channelID: channelData.ID,
						listener
					});
				}
			}
		}

		detach (options) {
			for (const event of this.Events) {
				for (const channelData of ChatModule.getTargets(options)) {
					const reference = this.attachmentReferences.find(i => i.channelID === channelData.ID);
					if (!reference) {
						continue;
					}

					channelData.events.off(event, reference.listener);
				}
			}
		}

		detachAll () {
			for (const target of this.attachmentReferences) {
				this.detach({
					channel: target
				});
			}
		}

		static getTargets (options) {
			const result = [];
			if (options.channel) {
				if (Array.isArray(options.channel)) {
					result.push(...options.channel);
				}
				else {
					result.push(options.channel);
				}
			}

			if (options.platform) {
				if (Array.isArray(options.platform)) {
					result.push(...options.platform.flatMap(i => sb.Channel.getJoinableForPlatform(i)));
				}
				else {
					result.push(...sb.Channel.getJoinableForPlatform(options.platform));
				}
			}

			return result;
		}

		/** @override */
		static async initialize () {
			await ChatModule.loadData();
			return ChatModule;
		}

		static async loadData () {
			const data = await sb.Query.getRecordset(rs => rs
				.select("Chat_Module.ID AS Module_ID")
				.select("Chat_Module.*")
				.select("Channel.ID AS Channel_ID")
				.select("Channel_Chat_Module.Specific_Arguments AS Args")
				.from("chat_data", "Chat_Module")
				.where("Active = %b", true)
				.reference({
					left: true,
					sourceTable: "Chat_Module",
					targetTable: "Channel",
					referenceTable: "Channel_Chat_Module",
					collapseOn: "Module_ID",
					fields: ["Channel_ID", "Args"]
				})
			);


			for (const row of data) {
				const chatModule = new ChatModule(row);
				if (row.Global) {
					if (row.Platform) {
						chatModule.attach({
							platform: row.Platform
						});
					}
					else {
						chatModule.attach({
							platform: sb.Platform.data
						});
					}
				}

				const channels = row.Channel.filter(i => i.ID);
				for (const channel of channels) {
					let args = [];
					if (channel.Args !== null) {
						try {
							args = JSON.parse(channel.Args);
						}
						catch (e) {
							console.warn("Chat module has invalid args for channel", chatModule, channel);
							continue;
						}
					}

					chatModule.attach({
						args,
						channel: sb.Channel.get(channel)
					});
				}

				ChatModule.data.push(chatModule);
			}
		}

		static async reloadData () {
			for (const chatModule of ChatModule.data) {
				chatModule.detachAll();
			}

			await ChatModule.loadData();
		}

		/**
		 * Cleans up.
		 */
		static destroy () {
			for (const chatModule of ChatModule.data) {
				chatModule.detachAll();
			}

			ChatModule.data = [];
		}
	};
})();