import { ObjectID } from "mongodb";
import { MongoObject } from "../../util";

export abstract class Item implements MongoObject {
	_id: ObjectID | string;
	createdOn: Date;
	lastModifiedOn: Date;
	removedOn?: Date;			// if this is set, the object has been removed / deleted
	className: string;
}