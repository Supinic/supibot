module.exports = (function () {
	"use strict";
	const EventEmitter = require("events");		
	const LongTimeout = require("long-timeout");
	const priority = {
		normal: 1,
		high: 10
	};

	/**
	 * Makes sure that messages are being sent no closer than in specified intervals.
	 * Useful for Twitch, where there is a global slowmode of some 1250ms if a user is not modded or VIP'd.
	 * @module MessageScheduler
	 */
	class MessageScheduler extends EventEmitter {
		constructor (options = {}) {
			super();

			this.queue = [];
			this.channelID = options.channelID || null;
			this.mode = options.mode;
			this.maxSize = options.maxSize || 5;
			this.interval = options.timeout || 1250;
		}
		
		schedule (message, timestamp = null) {
			if (timestamp === null && this.queue.length > this.maxSize) {
				this.emit("skip", message);
				return;
			}

			let targetTime = timestamp || (Date.now() + 50);
			let colliding = this.queue.filter(i => Math.abs(i.timestamp - targetTime) < this.interval);
			
			while (colliding.length !== 0) {
				targetTime += this.interval;
				colliding = this.queue.filter(i => Math.abs(i.timestamp - targetTime) < this.interval);
			}
		
			const id = Symbol();
			this.queue.push({
				id: id,
				priority: priority.normal,
				timestamp: targetTime,
				message: message,
				timeout: new LongTimeout(() => {
					this.emit("message", message);
					setTimeout(() => this.remove(id), this.interval);
				}, targetTime, true)
			});

			this.emit("queue", this.queue[this.queue.length - 1]);
		}
		
		remove (id) {
			const index = this.queue.findIndex(i => i.id === id);
			const removed = this.queue.splice(index, 1);

			this.emit("remove", removed);
			
			if (this.queue.length === 0) {
				this.emit("empty");
			}
		}
		
		destroy () {
			for (const item of this.queue) {
				if (item.timeout !== null) {
					item.timeout.clear();
					item.timeout = null;
				}
			}
			this.queue = [];
			this.emit("destroy");
		}
	}	
	
	return MessageScheduler;
})();