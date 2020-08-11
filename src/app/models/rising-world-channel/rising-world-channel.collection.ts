import { MongoCollection } from "../../../util";
import { RisingWorldChannel } from "./rising-world-channel";

const collection = (() => new MongoCollection<RisingWorldChannel>({ RisingWorldChannel }, 'channel'))();

if(!collection.Collection){
    throw new Error("NO COLLECTION");
}

export const channelCollection = collection;