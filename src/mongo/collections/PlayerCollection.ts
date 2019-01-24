import { MongoCollection } from "./MongoCollection";
import { RisingWorldPlayer } from "../models/RisingWorldPlayer";
import { Db, FilterQuery } from "mongodb";


export class PlayerCollection extends MongoCollection<RisingWorldPlayer>{


    /**
     *Creates an instance of PlayerCollection.
     * @param {Db} Database
     * @memberof PlayerCollection
     */
    constructor(Database: Db) {
        super(Database);
        try {
            this.Collection = Database.collection('player');
        } catch (error) {
            throw error;
        }
    }
}