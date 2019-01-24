import { Db } from "mongodb";
import { RisingWorldChannel } from "../models/RisingWorldChannel";
import { MongoCollection } from "./MongoCollection";


export class ChannelCollection extends MongoCollection<RisingWorldChannel>{


    /**
     *Creates an instance of ChannelCollection.
     * @param {Db} Database
     * @memberof ChannelCollection
     */
    constructor(Database: Db) {
		super(Database);
		try {
			this.Collection = Database.collection('channel');
		} catch (error) {
			throw error;
		}
	}
}