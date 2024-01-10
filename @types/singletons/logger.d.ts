import { Date as CoreDate, Error as CoreError } from "supi-core";

import { JSONifiable, Message } from "../globals";
import { Channel } from "../classes/channel";
import { Command } from "../classes/command";
import { Platform } from "../classes/platform";
import { Like as UserLike, User } from "../classes/user";

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
    Executed: CoreDate;
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

export declare class LoggerSingleton {
    constructor ();

    log (tag: LogTag, description?: string | null, channel?: HasID | null, user?: HasID | null ): Promise<number>;
    logError (type: ErrorType, error: Error | CoreError, data: ErrorLogData): Promise<number>;
    push (message: Message, userData: User, channelData: Channel, platformData?: Platform): Promise<void>;
    logVideoRequest (link: string, typeIdentifier: VideoType, length: number, userData: User, channelData: Channel): Promise<void>;
    logBan (identifier: UserLike, channelData: Channel, length: number, date: CoreDate, notes?: string | null): void;
    logCommandExecution (options: CommandExecutionOptions): void;
    updateLastSeen (options: LastSeenOptions): Promise<void>;
    getUserLastSeen (userID: number): CoreDate | undefined;
    destroy (): void;

    get modulePath (): "logger";
}
