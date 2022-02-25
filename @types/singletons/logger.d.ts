import { SingletonTemplate as Template } from "./template";
import { CustomDate as Date } from "../objects/date";
import { JSONifiable, Message } from "../globals";
import { Channel } from "../classes/channel";
import { Command } from "../classes/command";
import { Platform } from "../classes/platform";
import { Like as UserLike, User } from "../classes/user";
import { CustomError } from "../objects/error";

declare type PrimaryLogTag = "Command"| "Message"| "Twitch"| "Discord"| "Cytube"| "Module"| "System";
declare type SecondaryLogTag = "Request"| "Fail"| "Warning"| "Success"| "Shadowban"| "Ban"| "Clearchat"| "Sub"| "Giftsub"| "Host"| "Error"| "Timeout"| "Restart"| "Other"| "Ritual"| "Join";
declare type LogTag = `${PrimaryLogTag}.${SecondaryLogTag}`;

declare type ErrorType = "Backend" | "Command" | "Database" | "Website" | "Website - API" | "Other" | "Request";

declare type HasID = { ID: number };
declare type VideoType = string;
declare type LastSeenOptions = {
    channelData: Channel,
    message: Message,
    userData: User
};
declare type CommandExecutionOptions = {
    Executed: Date;
    User_Alias: User["ID"];
    Command: Command["Name"];
    Platform: Platform["ID"];
    Channel: Channel["ID"];
    Success: boolean;
    Invocation: string;
    Arguments: string[] | null;
    Result: string | null;
    Execution_Time: number;
};
declare type ErrorLogData = {
    origin?: "Internal" | "External" | null;
    message?: string | null;
    stack?: string | null;
    context?: JSONifiable;
    arguments?: JSONifiable;
};

export declare class LoggerSingleton implements Template {
    static module: LoggerSingleton;
    static singleton (): LoggerSingleton;

    constructor ();

    log (tag: LogTag, description?: string | null, channel?: HasID | null, user?: HasID | null ): Promise<void>;
    logError (type: ErrorType, error: Error | CustomError, data: ErrorLogData): Promise<number>;
    push (message: Message, userData: User, channelData: Channel, platformData?: Platform): Promise<void>;
    logVideoRequest (link: string, typeIdentifier: VideoType, length: number, userData: User, channelData: Channel): Promise<void>;
    logBan (identifier: UserLike, channelData: Channel, length: number, date: Date, notes?: string | null): void;
    logCommandExecution (options: CommandExecutionOptions): void;
    updateLastSeen (options: LastSeenOptions): Promise<void>;
    destroy (): void;

    get modulePath (): "logger";
}
