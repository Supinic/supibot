import { definition as ArgumentsBlock } from "./arguments.mjs";
import { definition as BestEmoteBlock } from "./best-emote.mjs";
import { definition as ChannelBlock } from "./channel.mjs";
import { definition as ChatterBlock } from "./chatter.mjs";
import { definition as ExecutorBlock } from "./executor.mjs";
import { definition as ExplodeBlock } from "./explode.mjs";
import { definition as PlatformBlock } from "./platform.mjs";
import { definition as RepeatBlock } from "./repeat.mjs";
import { definition as ReplaceBlock } from "./replace.mjs";
import { definition as SayBlock } from "./say.mjs";
import { definition as TeeBlock } from "./tee.mjs";

export const blocks = [
	ArgumentsBlock,
	BestEmoteBlock,
	ChannelBlock,
	ChatterBlock,
	ExecutorBlock,
	ExplodeBlock,
	PlatformBlock,
	RepeatBlock,
	ReplaceBlock,
	SayBlock,
	TeeBlock
];

export default blocks;
