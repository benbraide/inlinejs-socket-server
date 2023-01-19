import { Server, Socket } from 'socket.io';
import { createServer, Server as ServerType } from 'http';
import { IsObject } from '@benbraide/inlinejs';

const WEBSOCKET_CORS = {
   origin: '*',
   methods: ['GET', 'POST'],
}

type CustomEventHandlerType = (socket: Socket, ...args: any[]) => void;

class SocketServer extends Server{
    private static io_: SocketServer | null;
    private static http_: ServerType | null;

    private customEventHandlers_: Record<string, CustomEventHandlerType> = {};
    private logging_ = false;

    private eventHandler_: (...args: any[]) => void;
    
    constructor(http: any){
        super(http, {
            cors: WEBSOCKET_CORS,
        });

        const knownEvents = ['disconnecting', 'disconnect', 'error', 'subscribe', 'unsubscribe'];
        
        this.eventHandler_ = (socket: Socket) => {
            if (this.logging_){
                console.log(`Socket(${socket.id}) connected.`);
            }

            socket.onAny((eventName, ...args) => {
                if (knownEvents.includes(eventName)){
                    return;
                }
                
                if (this.customEventHandlers_.hasOwnProperty(eventName)){
                    if (this.logging_){
                        console.log(`Socket(${socket.id}) custom event received: ${eventName}`, ...args);
                    }

                    this.customEventHandlers_[eventName](socket, ...args);

                    return;
                }
                
                if (this.logging_){
                    console.log(`Socket(${socket.id}) event received: ${eventName}`, ...args);
                }

                const message = args[0];
                if (IsObject(message) && message.room && typeof message.room === 'string'){// Message is a room message
                    socket.to(message.room).emit(eventName, ...args);
                }
                else{// Message is a broadcast message
                    socket.broadcast.emit(eventName, ...args);
                }
            });
            
            socket.on('disconnecting', () => {
                if (this.logging_){
                    console.log(`Socket(${socket.id}) disconnecting.`);
                }
                
                for (const room of socket.rooms){// Alert clients in all rooms that the client was connected to that the client has disconnected
                    socket.to(room).emit('unsubscribed', {
                        room,
                        id: socket.id,
                    });
                }
            });

            socket.on('disconnect', () => {
                if (this.logging_){
                    console.log(`Socket(${socket.id}) disconnected.`);
                }
            });

            socket.on('error', (error) => {
                console.log('error', error);
            });

            socket.on('subscribe', (room: string) => {
                if (this.logging_){
                    console.log(`Socket(${socket.id}) subscribing to room: ${room}`);
                }
                
                let subscribed = () => {
                    if (this.logging_){
                        console.log(`Socket(${socket.id}) subscribed to room: ${room}`);
                    }
                    
                    this.in(room).fetchSockets().then(sockets => {
                        socket.emit('subscribed', {// Alert the client that they have subscribed with the list of sockets in the room
                            room,
                            clients: sockets.map(s => s.id),
                        });
                    });
                    
                    socket.to(room).emit('subscribed', {// Alert all clients in room that a new client has joined
                        room,
                        clients: [socket.id],
                    });

                    socket.emit('joined', room);// Alert the client that they have joined the room
                }, response = socket.join(room);

                (response instanceof Promise) ? response.then(subscribed) : subscribed();
            });

            socket.on('unsubscribe', (room: string) => {
                if (this.logging_){
                    console.log(`Socket(${socket.id}) unsubscribing from room: ${room}`);
                }
                
                let unsubscribed = () => {
                    if (this.logging_){
                        console.log(`Socket(${socket.id}) unsubscribed from room: ${room}`);
                    }
                    
                    socket.emit('left', room);// Alert the client that they have left the room
                    
                    socket.to(room).emit('unsubscribed', {// Alert all clients in room that a client has left
                        room,
                        id: socket.id,
                    });
                }, response = socket.leave(room);

                (response instanceof Promise) ? response.then(unsubscribed) : unsubscribed();
            });

            socket.emit('connected', socket.id);// Echo socket ID to the client that connected
        };
        
        SocketServer.http_ = http;
    }

    public get Logging(){
        return this.logging_;
    }
    
    public set Logging(value){
        this.logging_ = value;
    }

    public AddCustomEventHandler(eventName: string, handler: CustomEventHandlerType){
        this.customEventHandlers_[eventName] = handler;
    }

    public RemoveCustomEventHandler(eventName: string){
        delete this.customEventHandlers_[eventName];
    }

    public Start(){
        this.on('connection', this.eventHandler_);
    }

    public Stop(){
        this.off('connection', this.eventHandler_);
    }

    public static GetInstance(listener?: any, http?: any): SocketServer{
        if (!SocketServer.io_) {
            SocketServer.io_ = new SocketServer(http || SocketServer.GetHttpServer(listener));
        }
        
        return SocketServer.io_;
    }

    public static DestroyInstance(){
        SocketServer.io_?.Stop();
        SocketServer.io_?.close();
        SocketServer.io_ = null;
    }

    public static GetHttpServer(listener?: any): ServerType{
        if (!SocketServer.http_){
            SocketServer.http_ = createServer(listener);
        }
        
        return SocketServer.http_;
    }
}

export default SocketServer;