module.exports = (function () {
	"use strict";

	return class ChatModule {
		ID;
		Name;
		Events;
		Active = true;
		Code;
		attachedTo = [];
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
				for (const target of ChatModule.getTargets(options)) {
					target.events.on(event, this.Code);
					this.attachedTo.push(target);
				}
			}
		}

		detach (options) {
			for (const event of this.Events) {
				for (const target of ChatModule.getTargets(options)) {
					target.events.off(event, this.Code);
					const index = this.attachedTo.findIndex(i => i === target);
					if (index !== -1) {
						this.attachedTo.splice(index, 1);
					}
				}
			}
		}

		detachAll () {
			for (const target of this.attachedTo) {
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
				.from("chat_data", "Chat_Module")
				.where("Active = %b", true)
				.reference({
					sourceTable: "Chat_Module",
					targetTable: "Channel",
					referenceTable: "Channel_Chat_Module",
					collapseOn: "Module_ID",
					fields: ["Channel_ID"]
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

				if (row.Channel.length > 0) {
					chatModule.attach({
						channel: row.Channel.map(i => sb.Channel.get(i.ID)).filter(Boolean)
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