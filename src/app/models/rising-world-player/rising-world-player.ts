import { Item } from "../../item/item";

export class RisingWorldPlayer extends Item {
    _id: string = null;
    id64: string = null;	// big int
    name: string = null;	// The ingame name of this player,
    saveSettings: boolean = false;
    channels: string[] = [];
    online: boolean = false;
    override: boolean = false;

    static get emptyPlayer(): RisingWorldPlayer {
        return new RisingWorldPlayer();
    }
}