import { Server, Socket } from 'socket.io';
export interface ISocketServer extends Server {
    Logging: boolean;
}
export interface ICustomEventHandlerParams {
    server: ISocketServer;
    socket: Socket;
    room: string;
    eventName: string;
    args: any[];
}
export declare type CustomEventHandlerReturnType = void | boolean | ((socket: Socket) => void);
export declare type CustomEventHandlerType = (params: ICustomEventHandlerParams) => CustomEventHandlerReturnType;
export declare type CustomEventHandlerPayloadEchoType = (payload: any, getSockets?: () => Promise<Array<Socket> | Socket>) => void;
export interface ICustomEventHandlerWithEchoParams extends ICustomEventHandlerParams {
    echo: CustomEventHandlerPayloadEchoType;
}
export interface ICustomEventHandler {
    GetRoom(): string;
    GetEventName(): string;
    SetWhitelist(whitelist: Array<string> | string | null, replace?: boolean): void;
    SetBlacklist(blacklist: Array<string> | string | null, replace?: boolean): void;
    Handle: CustomEventHandlerType;
}
