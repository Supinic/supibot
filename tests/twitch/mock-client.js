const EventEmitter = require("events");
module.exports = class DankTwitchMock {
	static JoinError = class extends Error {};
	static SayError = class extends Error {};
	static TimeoutError = class extends Error {};
	static MessageError = class extends Error {};
	static WhisperMessage = class extends Object {};
	static ChatClient = class extends EventEmitter {
		connect () {}
		joinAll () {}
	}
};
