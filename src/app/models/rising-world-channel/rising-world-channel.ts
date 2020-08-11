import { Item } from "../../item/item";

export class RisingWorldChannel extends Item {
    _id: string = null;
    description: string = null;
    secure: boolean = false;
    password: string = null;
    ownerId: string = null;

    static get emptyChannel(): RisingWorldChannel {
        return new RisingWorldChannel();
    }
}