import { ObjectID } from "mongodb";

export interface GeneralObject {
	_id: ObjectID | string,
	createdOn: Date,
	lastModifiedOn: Date,
	removedOn?: Date,			// if this is set, the object has been removed / deleted
	system?: string				// defines the system for visibility
}