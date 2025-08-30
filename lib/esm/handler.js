var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { ToCamelCase } from "@benbraide/inlinejs";
export class CustomEventHandler {
    constructor(eventName_ = '*', room_ = '*') {
        this.eventName_ = eventName_;
        this.room_ = room_;
        this.whitelist_ = null;
        this.blacklist_ = null;
    }
    GetRoom() {
        return this.room_;
    }
    GetEventName() {
        return this.eventName_;
    }
    SetWhitelist(whitelist, replace) {
        const newWhitelist = (typeof whitelist === 'string') ? [whitelist] : whitelist;
        if (replace || !this.whitelist_ || !newWhitelist) {
            this.whitelist_ = newWhitelist;
        }
        else {
            this.whitelist_.push(...newWhitelist);
        }
    }
    SetBlacklist(blacklist, replace) {
        const newBlacklist = (typeof blacklist === 'string') ? [blacklist] : blacklist;
        if (replace || !this.blacklist_ || !newBlacklist) {
            this.blacklist_ = newBlacklist;
        }
        else {
            this.blacklist_.push(...newBlacklist);
        }
    }
    Handle(_a) {
        var { socket, room, eventName } = _a, rest = __rest(_a, ["socket", "room", "eventName"]);
        if (this.whitelist_ && !this.whitelist_.includes(eventName)) { // If a whitelist is set and the event name is not in the whitelist, then return
            return;
        }
        if (this.blacklist_ && this.blacklist_.includes(eventName)) { // If a blacklist is set and the event name is in the blacklist, then return
            return;
        }
        const formattedName = eventName.split(/[:.]/)
            .map(part => ToCamelCase(part, true))
            .join('');
        const handlerName = `On${formattedName}`;
        if (typeof this[handlerName] !== 'function') {
            return;
        }
        const echo = (data, getSockets) => {
            if (getSockets) {
                getSockets()
                    .then(sockets => (Array.isArray(sockets) ? sockets : [sockets]).forEach(s => this.Emit_(s, room, eventName, data)))
                    .catch(err => console.error(`[InlineJS-Socket]: Error getting sockets for event '${eventName}'.`, err));
            }
            else {
                this.Emit_(socket, room, eventName, data);
            }
        };
        this[handlerName](Object.assign({ echo, socket, room, eventName }, rest));
    }
    GetMessage_(args) {
        return args[0];
    }
    GetPayload_(args) {
        const message = this.GetMessage_(args);
        return ((message && typeof message === 'object') ? message.details.payload : null);
    }
    Emit_(socket, room, eventName, data) {
        socket.emit(eventName, {
            room,
            details: {
                id: socket.id,
                payload: data,
            },
        });
    }
}
