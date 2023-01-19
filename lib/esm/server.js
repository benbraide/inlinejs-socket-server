import { Server } from 'socket.io';
import { createServer } from 'http';
import { IsObject } from '@benbraide/inlinejs';
const WEBSOCKET_CORS = {
    origin: '*',
    methods: ['GET', 'POST'],
};
class SocketServer extends Server {
    constructor(http) {
        super(http, {
            cors: WEBSOCKET_CORS,
        });
        this.customEventHandlers_ = {};
        this.logging_ = false;
        const knownEvents = ['disconnecting', 'disconnect', 'error', 'subscribe', 'unsubscribe'];
        this.eventHandler_ = (socket) => {
            if (this.logging_) {
                console.log(`Socket(${socket.id}) connected.`);
            }
            socket.onAny((eventName, ...args) => {
                if (knownEvents.includes(eventName)) {
                    return;
                }
                if (this.customEventHandlers_.hasOwnProperty(eventName)) {
                    if (this.logging_) {
                        console.log(`Socket(${socket.id}) custom event received: ${eventName}`, ...args);
                    }
                    this.customEventHandlers_[eventName](socket, ...args);
                    return;
                }
                if (this.logging_) {
                    console.log(`Socket(${socket.id}) event received: ${eventName}`, ...args);
                }
                const message = args[0];
                if (IsObject(message) && message.room && typeof message.room === 'string') { // Message is a room message
                    socket.to(message.room).emit(eventName, ...args);
                }
                else { // Message is a broadcast message
                    socket.broadcast.emit(eventName, ...args);
                }
            });
            socket.on('disconnecting', () => {
                if (this.logging_) {
                    console.log(`Socket(${socket.id}) disconnecting.`);
                }
                for (const room of socket.rooms) { // Alert clients in all rooms that the client was connected to that the client has disconnected
                    socket.to(room).emit('unsubscribed', {
                        room,
                        id: socket.id,
                    });
                }
            });
            socket.on('disconnect', () => {
                if (this.logging_) {
                    console.log(`Socket(${socket.id}) disconnected.`);
                }
            });
            socket.on('error', (error) => {
                console.log('error', error);
            });
            socket.on('subscribe', (room) => {
                if (this.logging_) {
                    console.log(`Socket(${socket.id}) subscribing to room: ${room}`);
                }
                let subscribed = () => {
                    if (this.logging_) {
                        console.log(`Socket(${socket.id}) subscribed to room: ${room}`);
                    }
                    this.in(room).fetchSockets().then(sockets => {
                        socket.emit('subscribed', {
                            room,
                            clients: sockets.map(s => s.id),
                        });
                    });
                    socket.to(room).emit('subscribed', {
                        room,
                        clients: [socket.id],
                    });
                    socket.emit('joined', room); // Alert the client that they have joined the room
                }, response = socket.join(room);
                (response instanceof Promise) ? response.then(subscribed) : subscribed();
            });
            socket.on('unsubscribe', (room) => {
                if (this.logging_) {
                    console.log(`Socket(${socket.id}) unsubscribing from room: ${room}`);
                }
                let unsubscribed = () => {
                    if (this.logging_) {
                        console.log(`Socket(${socket.id}) unsubscribed from room: ${room}`);
                    }
                    socket.emit('left', room); // Alert the client that they have left the room
                    socket.to(room).emit('unsubscribed', {
                        room,
                        id: socket.id,
                    });
                }, response = socket.leave(room);
                (response instanceof Promise) ? response.then(unsubscribed) : unsubscribed();
            });
            socket.emit('connected', socket.id); // Echo socket ID to the client that connected
        };
        SocketServer.http_ = http;
    }
    get Logging() {
        return this.logging_;
    }
    set Logging(value) {
        this.logging_ = value;
    }
    AddCustomEventHandler(eventName, handler) {
        this.customEventHandlers_[eventName] = handler;
    }
    RemoveCustomEventHandler(eventName) {
        delete this.customEventHandlers_[eventName];
    }
    Start() {
        this.on('connection', this.eventHandler_);
    }
    Stop() {
        this.off('connection', this.eventHandler_);
    }
    static GetInstance(listener, http) {
        if (!SocketServer.io_) {
            SocketServer.io_ = new SocketServer(http || SocketServer.GetHttpServer(listener));
        }
        return SocketServer.io_;
    }
    static DestroyInstance() {
        var _a, _b;
        (_a = SocketServer.io_) === null || _a === void 0 ? void 0 : _a.Stop();
        (_b = SocketServer.io_) === null || _b === void 0 ? void 0 : _b.close();
        SocketServer.io_ = null;
    }
    static GetHttpServer(listener) {
        if (!SocketServer.http_) {
            SocketServer.http_ = createServer(listener);
        }
        return SocketServer.http_;
    }
}
export default SocketServer;
