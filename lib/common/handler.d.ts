import { ICustomEventHandler, ICustomEventHandlerParams } from "./types";
import { Socket } from "socket.io";
export declare class CustomEventHandler implements ICustomEventHandler {
    protected eventName_: string;
    protected room_: string;
    protected whitelist_: Array<string> | null;
    protected blacklist_: Array<string> | null;
    constructor(eventName_?: string, room_?: string);
    GetRoom(): string;
    GetEventName(): string;
    SetWhitelist(whitelist: Array<string> | string | null, replace?: boolean): void;
    SetBlacklist(blacklist: Array<string> | string | null, replace?: boolean): void;
    Handle({ socket, room, eventName, ...rest }: ICustomEventHandlerParams): void;
    protected GetMessage_(args: Array<any>): any;
    protected GetPayload_(args: Array<any>): any;
    protected Emit_(socket: Socket, room: string, eventName: string, data: any): void;
}
