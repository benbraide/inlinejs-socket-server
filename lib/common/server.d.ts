import { Server } from 'socket.io';
import { CustomEventHandlerType, ICustomEventHandler, ISocketServer } from './types';
interface ICustomEventHandlerInfo {
    room: string;
    eventName: string;
    handler: CustomEventHandlerType | ICustomEventHandler;
}
export declare class SocketServer extends Server implements ISocketServer {
    protected customEventHandlers_: ICustomEventHandlerInfo[];
    protected logging_: boolean;
    protected eventHandler_: (...args: any[]) => void;
    constructor(http: any);
    get Logging(): boolean;
    set Logging(value: boolean);
    AddCustomEventHandler(handler: CustomEventHandlerType | ICustomEventHandler, eventName?: string, room?: string): void;
    RemoveCustomEventHandler(handler: CustomEventHandlerType | ICustomEventHandler): void;
    Start(): void;
    Stop(): void;
    protected FindCustomEventHandlers_(room: string, eventName: string): ICustomEventHandlerInfo[];
}
export default SocketServer;
