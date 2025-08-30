import { Server, Socket } from 'socket.io';
import { IsObject, JournalTry } from '@benbraide/inlinejs';
import { CustomEventHandlerType, ICustomEventHandler, ISocketServer } from './types';

const WEBSOCKET_CORS = {
   origin: '*',
   methods: ['GET', 'POST'],
}

interface ICustomEventHandlerInfo{
    room: string;
    eventName: string;
    handler: CustomEventHandlerType | ICustomEventHandler;
}

export class SocketServer extends Server implements ISocketServer{
    protected customEventHandlers_ = new Array<ICustomEventHandlerInfo>();
    protected logging_ = false;

    protected eventHandler_: (...args: any[]) => void;
    
    constructor(http: any){
        super(http, {
            cors: WEBSOCKET_CORS,
        });

        const handleDisconnecting = (after: ((socket: Socket) => void) | null, socket: Socket) => {
            this.logging_ && console.log(`Socket(${socket.id}) disconnecting.`);
            for (const room of socket.rooms){// Alert clients in all rooms that the client was connected to that the client has disconnected
                socket.to(room).emit('socket:unsubscribed', {
                    room,
                    id: socket.id,
                });
            }
            after && after(socket);
        };

        const handleDisconnect = (after: ((socket: Socket) => void) | null, socket: Socket) => {
            this.logging_ && console.log(`Socket(${socket.id}) disconnected.`);
            after && after(socket);
        };

        const handleError = (after: ((socket: Socket) => void) | null, socket: Socket, error: any) => {
            this.logging_ && console.log(`Socket(${socket.id}) error:`, error);
            after && after(socket);
        }

        const handleSubscribe = (after: ((socket: Socket) => void) | null, socket: Socket, room: string) => {
            this.logging_ && console.log(`Socket(${socket.id}) subscribing to room: ${room}`);
            const response = socket.join(room), subscribed = () => {
                this.logging_ && console.log(`Socket(${socket.id}) subscribed to room: ${room}`);
                
                socket.emit('socket:join', { room });// Alert the client that they have joined the room

                this.in(room).fetchSockets().then(sockets => {
                    socket.emit('socket:subscribe', {// Alert the client that they have subscribed with the list of sockets in the room
                        room,
                        clients: sockets.map(s => s.id),
                    });
                });
                
                socket.to(room).emit('socket:subscribe', {// Alert all clients in room that a new client has joined
                    room,
                    clients: [socket.id],
                });

                after && after(socket);
            };

            (response instanceof Promise) ? response.then(subscribed) : subscribed();
        };

        const handleUnsubscribe = (after: ((socket: Socket) => void) | null, socket: Socket, room: string) => {
            this.logging_ && console.log(`Socket(${socket.id}) unsubscribing from room: ${room}`);
            const response = socket.leave(room), unsubscribed = () => {
                this.logging_ && console.log(`Socket(${socket.id}) unsubscribed from room: ${room}`);
                
                socket.to(room).emit('socket:unsubscribe', {// Alert all clients in room that a client has left
                    room,
                    id: socket.id,
                });
                socket.emit('socket:leave', { room });// Alert the client that they have left the room

                after && after(socket);
            };

            (response instanceof Promise) ? response.then(unsubscribed) : unsubscribed();
        };

        const handlers = {
            'socket:subscribe': handleSubscribe,
            'socket:join': handleSubscribe,
            'socket:unsubscribe': handleUnsubscribe,
            'socket:leave': handleUnsubscribe,
        };
        
        this.eventHandler_ = (socket: Socket) => {
            this.logging_ && console.log(`Socket(${socket.id}) connected.`);

            const callHandler = (handler: CustomEventHandlerType | ICustomEventHandler, room: string, eventName: string, ...args: any[]) => {
                const params = { server: this, socket, room, eventName, args };
                return ((typeof handler === 'function') ? handler(params) : handler.Handle(params));
            };
            
            const callCustomEventHandler = (room: string, eventName: string, ...args: any[]) => {
                let afters = new Array<(socket: Socket) => void>(), isRejected = false;

                const customHandlers = this.FindCustomEventHandlers_(room, eventName);
                this.logging_ && console.log(`Socket(${socket.id}) found ${customHandlers.length} custom handlers for event: ${eventName}`, ...args);
                
                customHandlers.forEach((info) => JournalTry(() => {
                    const response = callHandler(info.handler, room, eventName, ...args);
                    if (typeof response === 'function'){
                        afters.push(response);
                    }
                    else if (response === false){
                        isRejected = true;
                    }
                }));

                return isRejected ? false : () => afters.forEach(after => JournalTry(() => after(socket)));
            };

            socket.onAny((eventName, ...args) => {
                const message = args[0];
                let room: string;

                // Determine room for custom event handler filtering and for custom event broadcasting
                if ((eventName in handlers) && typeof message === 'string') {
                    room = message; // For built-in events, the room is the payload string
                } else if (IsObject(message) && message.room && typeof message.room === 'string') {
                    room = message.room; // For custom events, it's in the payload object
                } else {
                    room = '*'; // Default/wildcard
                }
                
                const after = callCustomEventHandler(room, eventName, ...args);
                if (after === false){
                    return;
                }
                
                if (eventName in handlers){
                    // Handle known events. The room is the first argument.
                    handlers[eventName](after, socket, ...args);
                }
                else{// It's a custom event, broadcast it
                    (room === '*') ? socket.broadcast.emit(eventName, ...args) : socket.to(room).emit(eventName, ...args);
                    after && after();
                }
            });

            socket.on('disconnecting', () => {
                const after = callCustomEventHandler('*', 'socket:disconnecting');
                if (after !== false){
                    handleDisconnecting(after, socket);
                }
            });

            socket.on('disconnect', () => {
                const after = callCustomEventHandler('*', 'socket:disconnect');
                if (after !== false){
                    handleDisconnect(after, socket);
                }
            });

            socket.on('error', (error) => {
                const after = callCustomEventHandler('*', 'socket:error', error);
                if (after !== false){
                    handleError(after, socket, error);
                }
            });

            const after = callCustomEventHandler('*', 'socket:connect');
            if (after !== false){
                socket.emit('socket:connect', socket.id);// Echo socket ID to the client that connected
                after && after();
            }
        };
    }

    public get Logging(){
        return this.logging_;
    }
    
    public set Logging(value){
        this.logging_ = value;
    }

    public AddCustomEventHandler(handler: CustomEventHandlerType | ICustomEventHandler, eventName = '*', room = '*'){
        let info: ICustomEventHandlerInfo;
        if (typeof handler !== 'function'){
            info = {
                room: (handler.GetRoom() || room),
                eventName: (handler.GetEventName() || eventName),
                handler,
            };
        }
        else{
            info = { room, eventName, handler };
        }
        
        info.eventName && this.customEventHandlers_.push(info);
    }

    public RemoveCustomEventHandler(handler: CustomEventHandlerType | ICustomEventHandler){
        const index = this.customEventHandlers_.findIndex(h => h.handler === handler);
        (index >= 0) && this.customEventHandlers_.splice(index, 1);
    }

    public Start(){
        this.on('connection', this.eventHandler_);
    }

    public Stop(){
        this.off('connection', this.eventHandler_);
    }

    protected FindCustomEventHandlers_(room: string, eventName: string){
        return this.customEventHandlers_.filter(h => (h.room === '*' || h.room === room) && (h.eventName === '*' || h.eventName === eventName));
    }
}

export default SocketServer;