"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketServer = void 0;
const socket_io_1 = require("socket.io");
const inlinejs_1 = require("@benbraide/inlinejs");
const WEBSOCKET_CORS = {
    origin: '*',
    methods: ['GET', 'POST'],
};
class SocketServer extends socket_io_1.Server {
    constructor(http) {
        super(http, {
            cors: WEBSOCKET_CORS,
        });
        this.customEventHandlers_ = new Array();
        this.logging_ = false;
        const handleDisconnecting = (after, socket) => {
            this.logging_ && console.log(`Socket(${socket.id}) disconnecting.`);
            for (const room of socket.rooms) { // Alert clients in all rooms that the client was connected to that the client has disconnected
                socket.to(room).emit('socket:unsubscribed', {
                    room,
                    id: socket.id,
                });
            }
            after && after(socket);
        };
        const handleDisconnect = (after, socket) => {
            this.logging_ && console.log(`Socket(${socket.id}) disconnected.`);
            after && after(socket);
        };
        const handleError = (after, socket, error) => {
            this.logging_ && console.log(`Socket(${socket.id}) error:`, error);
            after && after(socket);
        };
        const handleSubscribe = (after, socket, room) => {
            this.logging_ && console.log(`Socket(${socket.id}) subscribing to room: ${room}`);
            const response = socket.join(room), subscribed = () => {
                this.logging_ && console.log(`Socket(${socket.id}) subscribed to room: ${room}`);
                socket.emit('socket:join', { room }); // Alert the client that they have joined the room
                this.in(room).fetchSockets().then(sockets => {
                    socket.emit('socket:subscribe', {
                        room,
                        clients: sockets.map(s => s.id),
                    });
                });
                socket.to(room).emit('socket:subscribe', {
                    room,
                    clients: [socket.id],
                });
                after && after(socket);
            };
            (response instanceof Promise) ? response.then(subscribed) : subscribed();
        };
        const handleUnsubscribe = (after, socket, room) => {
            this.logging_ && console.log(`Socket(${socket.id}) unsubscribing from room: ${room}`);
            const response = socket.leave(room), unsubscribed = () => {
                this.logging_ && console.log(`Socket(${socket.id}) unsubscribed from room: ${room}`);
                socket.to(room).emit('socket:unsubscribe', {
                    room,
                    id: socket.id,
                });
                socket.emit('socket:leave', { room }); // Alert the client that they have left the room
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
        this.eventHandler_ = (socket) => {
            this.logging_ && console.log(`Socket(${socket.id}) connected.`);
            const callHandler = (handler, room, eventName, ...args) => {
                const params = { server: this, socket, room, eventName, args };
                return ((typeof handler === 'function') ? handler(params) : handler.Handle(params));
            };
            const callCustomEventHandler = (room, eventName, ...args) => {
                let afters = new Array(), isRejected = false;
                const customHandlers = this.FindCustomEventHandlers_(room, eventName);
                this.logging_ && console.log(`Socket(${socket.id}) found ${customHandlers.length} custom handlers for event: ${eventName}`, ...args);
                customHandlers.forEach((info) => (0, inlinejs_1.JournalTry)(() => {
                    const response = callHandler(info.handler, room, eventName, ...args);
                    if (typeof response === 'function') {
                        afters.push(response);
                    }
                    else if (response === false) {
                        isRejected = true;
                    }
                }));
                return isRejected ? false : () => afters.forEach(after => (0, inlinejs_1.JournalTry)(() => after(socket)));
            };
            socket.onAny((eventName, ...args) => {
                const message = args[0];
                let room;
                // Determine room for custom event handler filtering and for custom event broadcasting
                if ((eventName in handlers) && typeof message === 'string') {
                    room = message; // For built-in events, the room is the payload string
                }
                else if ((0, inlinejs_1.IsObject)(message) && message.room && typeof message.room === 'string') {
                    room = message.room; // For custom events, it's in the payload object
                }
                else {
                    room = '*'; // Default/wildcard
                }
                const after = callCustomEventHandler(room, eventName, ...args);
                if (after === false) {
                    return;
                }
                if (eventName in handlers) {
                    // Handle known events. The room is the first argument.
                    handlers[eventName](after, socket, ...args);
                }
                else { // It's a custom event, broadcast it
                    (room === '*') ? socket.broadcast.emit(eventName, ...args) : socket.to(room).emit(eventName, ...args);
                    after && after();
                }
            });
            socket.on('disconnecting', () => {
                const after = callCustomEventHandler('*', 'socket:disconnecting');
                if (after !== false) {
                    handleDisconnecting(after, socket);
                }
            });
            socket.on('disconnect', () => {
                const after = callCustomEventHandler('*', 'socket:disconnect');
                if (after !== false) {
                    handleDisconnect(after, socket);
                }
            });
            socket.on('error', (error) => {
                const after = callCustomEventHandler('*', 'socket:error', error);
                if (after !== false) {
                    handleError(after, socket, error);
                }
            });
            const after = callCustomEventHandler('*', 'socket:connect');
            if (after !== false) {
                socket.emit('socket:connect', socket.id); // Echo socket ID to the client that connected
                after && after();
            }
        };
    }
    get Logging() {
        return this.logging_;
    }
    set Logging(value) {
        this.logging_ = value;
    }
    AddCustomEventHandler(handler, eventName = '*', room = '*') {
        let info;
        if (typeof handler !== 'function') {
            info = {
                room: (handler.GetRoom() || room),
                eventName: (handler.GetEventName() || eventName),
                handler,
            };
        }
        else {
            info = { room, eventName, handler };
        }
        info.eventName && this.customEventHandlers_.push(info);
    }
    RemoveCustomEventHandler(handler) {
        const index = this.customEventHandlers_.findIndex(h => h.handler === handler);
        (index >= 0) && this.customEventHandlers_.splice(index, 1);
    }
    Start() {
        this.on('connection', this.eventHandler_);
    }
    Stop() {
        this.off('connection', this.eventHandler_);
    }
    FindCustomEventHandlers_(room, eventName) {
        return this.customEventHandlers_.filter(h => (h.room === '*' || h.room === room) && (h.eventName === '*' || h.eventName === eventName));
    }
}
exports.SocketServer = SocketServer;
exports.default = SocketServer;
