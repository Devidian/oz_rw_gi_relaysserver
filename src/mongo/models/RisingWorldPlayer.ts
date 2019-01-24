import { GeneralObject } from "./GeneralObject";

export interface RisingWorldPlayer extends GeneralObject {
    _id: string,
    id64: string,   // long id, cant be handled as number in javascript right now
    name: string    // The ingame name of this player,
    saveSettings: boolean,
    channels: string[],
    online: boolean,
    override: boolean
}

export var EmptyPlayer: RisingWorldPlayer = {
    _id: null,
    channels: [],
    createdOn: null,
    id64: null,
    lastModifiedOn: null,
    name: null,
    saveSettings: false,
    online: false,
    override: false
}