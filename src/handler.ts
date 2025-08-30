import { ToCamelCase } from "@benbraide/inlinejs";
import { CustomEventHandlerPayloadEchoType, ICustomEventHandler, ICustomEventHandlerParams } from "./types";
import { Socket } from "socket.io";

export class CustomEventHandler implements ICustomEventHandler{
    protected whitelist_: Array<string> | null = null;
    protected blacklist_: Array<string> | null = null;
    
    public constructor(protected eventName_ = '*', protected room_ = '*'){}
    
    public GetRoom(): string{
        return this.room_;
    }

    public GetEventName(): string{
        return this.eventName_;
    }

    public SetWhitelist(whitelist: Array<string> | string | null, replace?: boolean){
        const newWhitelist = (typeof whitelist === 'string') ? [whitelist] : whitelist;
        if (replace || !this.whitelist_ || !newWhitelist) {
            this.whitelist_ = newWhitelist;
        } else {
            this.whitelist_.push(...newWhitelist);
        }
    }

    public SetBlacklist(blacklist: Array<string> | string | null, replace?: boolean){
        const newBlacklist = (typeof blacklist === 'string') ? [blacklist] : blacklist;
        if (replace || !this.blacklist_ || !newBlacklist) {
            this.blacklist_ = newBlacklist;
        } else {
            this.blacklist_.push(...newBlacklist);
        }
    }

    public Handle({ socket, room, eventName, ...rest }: ICustomEventHandlerParams): void{
        if (this.whitelist_ && !this.whitelist_.includes(eventName)){// If a whitelist is set and the event name is not in the whitelist, then return
            return;
        }

        if (this.blacklist_ && this.blacklist_.includes(eventName)){// If a blacklist is set and the event name is in the blacklist, then return
            return;
        }
        
        const formattedName = eventName.split(/[:.]/)
            .map(part => ToCamelCase(part, true))
            .join('');

        const handlerName = `On${formattedName}`;
        if (typeof this[handlerName] !== 'function'){
            return;
        }

        const echo: CustomEventHandlerPayloadEchoType = (data, getSockets) => {
            if (getSockets){
                getSockets()
                    .then(sockets => (Array.isArray(sockets) ? sockets : [sockets]).forEach(s => this.Emit_(s, room, eventName, data)))
                    .catch(err => console.error(`[InlineJS-Socket]: Error getting sockets for event '${eventName}'.`, err));
            }
            else{
                this.Emit_(socket, room, eventName, data);
            }
        };
        
        this[handlerName]({ echo, socket, room, eventName, ...rest });
    }

    protected GetMessage_(args: Array<any>){
        return args[0];
    }

    protected GetPayload_(args: Array<any>){
        const message = this.GetMessage_(args);
        return ((message && typeof message === 'object') ? message.details.payload : null);
    }

    protected Emit_(socket: Socket, room: string, eventName: string, data: any){
        socket.emit(eventName, {
            room,
            details: {
                id: socket.id,
                payload: data,
            },
        });
    }
}
