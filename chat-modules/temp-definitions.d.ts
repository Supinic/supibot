import type { Channel } from "../classes/channel.js";
import type { User } from "../classes/user.js";
import type { ChatModule } from "../classes/chat-module.js";

type BaseChatModuleContext = {
	channel: Channel | null;
	message: string | null;
	raw: string | null;
	user: User | null;
};
export type MessageChatModuleContext = BaseChatModuleContext & {
	channel: Channel | null;
	message: string;
	raw?: null;
	user: User;
};
export type RawUserMessageChatModuleContext = BaseChatModuleContext & {
	channel: Channel | null;
	message: string;
	raw: string;
	user?: null;
};

export type GenericChatModuleContext =
	| MessageChatModuleContext
	| RawUserMessageChatModuleContext;

export interface ChatModuleDefinition {
	Name: string;
	Events: string[];
	Description: string | null;
	Code: (this: ChatModule, context: GenericChatModuleContext) => Promise<void>;
}
export interface MessageChatModuleDefinition {
	Name: string;
	Events: ["message"];
	Description: string | null;
	Code: (this: ChatModule, context: MessageChatModuleContext | RawUserMessageChatModuleContext) => Promise<void>;
}
