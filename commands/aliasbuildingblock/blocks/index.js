const ArgumentsBlock = require("./arguments.js");
const BestEmoteBlock = require("./best-emote.js");
const ChannelBlock = require("./channel.js");
const ChatterBlock = require("./chatter.js");
const ExecutorBlock = require("./executor.js");
const ExplodeBlock = require("./explode.js");
const LinkifyBlock = require("./linkify.js");
const PlatformBlock = require("./platform.js");
const RepeatBlock = require("./repeat.js");
const ReplaceBlock = require("./replace.js");
const SayBlock = require("./say.js");
const TeeBlock = require("./tee.js");

const blocks = [
	ArgumentsBlock,
	BestEmoteBlock,
	ChannelBlock,
	ChatterBlock,
	ExecutorBlock,
	ExplodeBlock,
	LinkifyBlock,
	PlatformBlock,
	RepeatBlock,
	ReplaceBlock,
	SayBlock,
	TeeBlock
];

export default {
	blocks
};
