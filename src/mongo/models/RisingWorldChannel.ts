import { GeneralObject } from "./GeneralObject";

export interface RisingWorldChannel extends GeneralObject {
    _id: string,
    description: string,
    secure: boolean,
    password: string,
    ownerId: string
}

export var defaultChannel: RisingWorldChannel = {
    _id: null,
    createdOn: new Date(),
    lastModifiedOn: new Date(),
    description: null,
    ownerId: null,
    password: null,
    secure: false
}