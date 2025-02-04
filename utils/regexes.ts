export const asciiArtRegex = /([\u2591\u2588\u2500\u2580\u2593\u2584\u2592])/g;
export const emojiRegex = /[\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F191}-\u{1F251}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{3297}\u{3299}\u{303D}\u{00A9}\u{00AE}\u{2122}\u{23F3}\u{24C2}\u{23E9}-\u{23EF}\u{25B6}\u{23F8}-\u{23FA}]/gu;
export const linkRegex = /(https?:\/\/)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&/=]*)/gi;
// eslint-disable-next-line no-misleading-character-class
export const whitespaceRegex = /[\u0000-\u0009\u000B-\u000C\u000E-\u001F\u0080-\u00A0\u00AD\u034F\u0600-\u0605\u061C\u061D\u070F\u08E2\u115F\u1160\u13FE-\u13FF\u17B4-\u17B5\u180B\u180F\u2000-\u200C\u200D\u200E\u200F\u2028-\u202F\u205F\u2060-\u206F\u2D26\u2800\u3000\u3164\uE000-\uF8FF\uFE00-\uFE0E\uFE20-\uFE2F\uFEFF\uFFA0\uFFF9-\uFFFB\uFFFD-\uFFFF\u{110BD}\u{110CD}\u{13430}-\u{13438}\u{1BCA0}-\u{1BCA3}\u{1D173}-\u{1D17A}\u{E0000}\u{E0001}\u{E0003}-\u{E007F}\u{E0100}-\u{E01EF}\u{F0000}-\u{FFFFF}\u{100000}-\u{10FFFF}]/gu;

export default {
	asciiArtRegex,
	emojiRegex,
	linkRegex,
	whitespaceRegex
};
