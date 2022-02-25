import { SingletonTemplate as Template } from "./template";
import { SimpleGenericData } from "../globals";

export declare type Identifier = number | string | null;
export declare type CooldownOptions = unknown;
export declare type UnsetOptions = unknown;

declare abstract class Inhibitor {
    readonly user: Identifier;

    protected constructor (data: SimpleGenericData);

    check (...args: Identifier[]): boolean;
    revoke (): void;
}

export declare class Cooldown implements Inhibitor {
    #channel: Identifier;
    #user: Identifier;
    #command: Identifier;
    #expires: number;

    constructor (data: { channel?: Identifier, user?: Identifier, command?: Identifier, expires: number });

    check (channel: Identifier, user: Identifier, command: Identifier): boolean;
    revoke (): void;

    get channel (): Identifier;
    get command (): Identifier;
    get user (): Identifier;
    get expires (): number;
}
export declare class Pending implements Inhibitor {
    #description: string;
    #user: Identifier;
    #expires: number;

    constructor (data: { user?: Identifier, description?: string, expires: number });

    check (user: Identifier): boolean;
    revoke (): void;

    get description (): string;
    get expires (): number;
    get user (): Identifier;
}

export declare class CooldownManagerSingleton implements Template {
    static module: CooldownManagerSingleton;
    static singleton (): CooldownManagerSingleton;

    data: Cooldown | Pending[];
    readonly pendingCooldownExpiration: number;

    constructor ();

    set (channel: Identifier, user: Identifier, command: Identifier, cooldown: number, options?: CooldownOptions): void;
    check (channel: Identifier, user: Identifier, command: Identifier, skipPending: boolean): boolean;
    unset (channel: Identifier, user: Identifier, command: Identifier, options: UnsetOptions): void;
    setPending (user: Identifier, description?: string): void;
    fetchPending (user: Identifier): Pending;
    unsetPending (user: Identifier): void;
    prune (): void;
    destroy (): void;

    get Cooldown (): typeof Cooldown;
    get Pending (): typeof Pending;

    get pruneCron (): unknown;
    get modulePath (): "cooldown-manager";
}
