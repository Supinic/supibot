module.exports = {
	asciiArtRegex: /([\u2591\u2588\u2500\u2580\u2593\u2584\u2592])/g,
	emojiRegex: /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu,
	linkRegex: /(https?:\/\/)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&/=]*)/gi,
	// eslint-disable-next-line no-misleading-character-class
	whitespaceRegex: /[\x00-\x09\x0B-\x0C\x0E-\x1F\u0080-\u00A0\u00AD\u034F\u0600-\u0605\u061C\u061D\u070F\u08E2\u115F\u1160\u13FE-\u13FF\u17B4-\u17B5\u180B\u180F\u2000-\u200C\u200D\u200E\u200F\u2028-\u202F\u205F\u2060-\u206F\u2D26\u2800\u3000\u3164\uE000-\uF8FF\uFE00-\uFE0E\uFE20-\uFE2F\uFEFF\uFFA0\uFFF9-\uFFFB\uFFFD-\uFFFF\u{110BD}\u{110CD}\u{13430}-\u{13438}\u{1BCA0}-\u{1BCA3}\u{1D173}-\u{1D17A}\u{E0000}\u{E0001}\u{E0003}-\u{E007F}\u{E0100}-\u{E01EF}\u{F0000}-\u{FFFFF}\u{100000}-\u{10FFFF}]/gu
};
