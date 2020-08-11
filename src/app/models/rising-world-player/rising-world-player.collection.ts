import { MongoCollection } from "../../../util";
import { RisingWorldPlayer } from "./rising-world-player";

const collection = (() => new MongoCollection<RisingWorldPlayer>({ RisingWorldPlayer }, 'player'))();

if(!collection.Collection){
    throw new Error("NO COLLECTION");
}

export const playerCollection = collection;