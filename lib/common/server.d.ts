/// <reference types="node" />
import { Server, Socket } from 'socket.io';
import { Server as ServerType } from 'http';
declare type CustomEventHandlerType = (socket: Socket, ...args: any[]) => void;
declare class SocketServer extends Server {
    private static io_;
    private static http_;
    private customEventHandlers_;
    private logging_;
    private eventHandler_;
    constructor(http: any);
    get Logging(): boolean;
    set Logging(value: boolean);
    AddCustomEventHandler(eventName: string, handler: CustomEventHandlerType): void;
    RemoveCustomEventHandler(eventName: string): void;
    Start(): void;
    Stop(): void;
    static GetInstance(listener?: any, http?: any): SocketServer;
    static DestroyInstance(): void;
    static GetHttpServer(listener?: any): ServerType;
}
export default SocketServer;
