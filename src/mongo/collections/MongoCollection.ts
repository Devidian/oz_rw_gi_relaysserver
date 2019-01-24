import { createHmac } from "crypto";
import { ChangeStream, ChangeStreamOptions, Collection, CommonOptions, Cursor, Db, DeleteWriteOpResultObject, FilterQuery, ObjectID, ReplaceOneOptions, UpdateWriteOpResult } from "mongodb";
import { types } from "util";
import { LOGTAG, cfg } from "../../config";
import { GeneralObject } from "../models/GeneralObject";


/** Help Class with general methods
 *
 * @param {type} Database
 * @returns {MongoCollection}
 */
export class MongoCollection<TC extends GeneralObject> {
	protected Collection: Collection;
	protected DB: Db;
	protected Options = { all: {} };
	protected Cursor: Cursor<Object> = null;
	protected DEFAULT_CS_OPTION: any = {
		readPreference: "secondaryPreferred"
	}

	/**
	 * Creates an instance of MongoCollection.
	 * @param {Db} Database
	 * @memberof MongoCollection
	 */
	constructor(Database: Db) {
		this.DB = Database;
	};

	/**
	 * default save document method (override if you need somethng special)
	 * uses updateOne with upsert to save document
	 *
	 * @param {*} doc
	 * @returns {Promise<TC>}
	 *
	 * @memberof MongoDB
	 */
	public save(doc: TC): Promise<TC> {
		const N = new Date();
		// ensure ObjectID
		doc._id = ObjectID.isValid(doc._id) && new ObjectID(doc._id + "") + '' == doc._id + '' ? new ObjectID(doc._id + "") : doc._id; // in case of a valid object id that was incorrectly string, convert it
		if (!doc._id) {
			doc._id = new ObjectID();
		}
		doc.createdOn = doc.createdOn || N; // set createdOn if not set
		// doc.lastModifiedOn = N; // will be set in atomicSave

		return this.atomicSave(doc);
	};

	/**
	 *
	 *
	 * @param {FilterQuery<TC>} Filter
	 * @returns {Promise<UpdateWriteOpResult>}
	 * @memberof MongoCollection
	 */
	public softRemove(Filter: FilterQuery<TC>): Promise<UpdateWriteOpResult> {
		const now = new Date();
		return this.Collection.updateMany(Filter, { $set: { removedOn: now } });
	}

	/**
	 *
	 *
	 * @param {FilterQuery<TC>} Filter
	 * @returns {Promise<UpdateWriteOpResult>}
	 * @memberof MongoCollection
	 */
	public restore(Filter: FilterQuery<TC>): Promise<UpdateWriteOpResult> {
		return this.Collection.updateMany(Filter, { $unset: { removedOn: 1 } });
	}

	/**
	 *
	 *
	 * @param {FilterQuery<TC>} Filter
	 * @returns {Promise<DeleteWriteOpResultObject>}
	 * @memberof MongoCollection
	 */
	public hardRemove(Filter: FilterQuery<TC>): Promise<DeleteWriteOpResultObject> {
		return this.Collection.deleteMany(Filter);
	}

	/**
	 *
	 *
	 * @protected
	 * @param {string} key
	 * @param {Object} nDoc
	 * @param {Object} oDoc
	 * @returns {any[]}
	 * @memberof MongoCollection
	 */
	protected deepUpdate(key: string, nDoc: Object, oDoc: Object): any[] {
		let result = [];
		for (const prop in nDoc) {
			try {
				let upKey = key + '.' + prop;
				if (nDoc.hasOwnProperty(prop)) {
					const isObjectID = ObjectID.isValid(nDoc[prop]) && nDoc[prop].length > 12;
					if (!oDoc || !oDoc[prop]) {
						result.push({ path: upKey, value: nDoc[prop] });
					} else if (isObjectID || types.isDate(nDoc[prop])) {
						// respect ObjectID an Date
						if (oDoc[prop] != nDoc[prop]) {
							result.push({ path: upKey, value: nDoc[prop] });
						}
					} else if (Array.isArray(nDoc[prop])) {
						if (JSON.stringify(oDoc[prop]) != JSON.stringify(nDoc[prop])) {
							result.push({ path: upKey, value: nDoc[prop] });
						}
					} else if (nDoc[prop] !== null && typeof nDoc[prop] === 'object') {
						// nDoc[prop] is an object
						this.deepUpdate(upKey, nDoc[prop], oDoc[prop]).forEach(element => {
							result.push(element);
						});
					} else if (!oDoc || !oDoc.hasOwnProperty(prop) || oDoc[prop] === undefined || oDoc[prop] != nDoc[prop]) {
						// oDoc has no prop with this key or it is unequal but not an object
						// console.log('[DEV]', `Unequal: ${!oDoc} || ${!oDoc.hasOwnProperty(prop)} || ${!oDoc[prop]} || <${oDoc[prop] != nDoc[prop]}>`);
						result.push({ path: upKey, value: nDoc[prop] })
					} else {
						// nDoc[prop] is not an object, oDoc has this property and it is equal
					}
				}
			} catch (error) {
				console.log(LOGTAG.ERROR, `[MongoCollection::deepUpdate]`, error);
			}
		}
		return result;
	}

	/**
	 *
	 *
	 * @protected
	 * @param {*} nDoc new Document
	 * @param {*} oDoc old Document
	 * @returns {Promise<any>}
	 * @memberof MongoCollection
	 */
	protected createUpdate(nDoc: any, oDoc: any): Promise<any> {
		let target = {};
		for (const key in nDoc) {
			if (nDoc.hasOwnProperty(key)) {
				const isObjectID = ObjectID.isValid(nDoc[key]) && nDoc[key].length > 12;
				if (isObjectID || types.isDate(nDoc[key])) {
					if (oDoc[key] != nDoc[key]) {
						target[key] = nDoc[key];
					}
				} else if (Array.isArray(nDoc[key])) {
					if (JSON.stringify(oDoc[key]) != JSON.stringify(nDoc[key])) {
						target[key] = nDoc[key];
					}
				} else if (nDoc[key] !== null && typeof nDoc[key] === 'object') {
					// nDoc[key] is an object
					this.deepUpdate(key, nDoc[key], oDoc[key]).forEach(element => {
						// console.log('compare',from[key],to[key]);
						target[element.path] = element.value;
					});
				} else if (!oDoc || !oDoc.hasOwnProperty(key) || oDoc[key] === undefined || oDoc[key] != nDoc[key]) {
					// oDoc has no prop with this key or it is unequal but not an object
					// console.log('[DEV]', `Unequal: ${!oDoc} || ${!oDoc.hasOwnProperty(key)} || ${!oDoc[key]} || <${oDoc[key] != nDoc[key]}>`);
					target[key] = nDoc[key];
				} else {
					// nDoc[key] is not an object, oDoc has this property and it is equal
				}
			}
		}
		return Promise.resolve(target);
	}

	/**
	 * creates an atomic update, instead of updating the complete document,
	 * only changes will be updated even in deep objects
	 *
	 * property:{a:{b:c}} becomes
	 * 'property.a.b' = c
	 *
	 * @param {*} doc2save
	 * @returns {Promise<TC>}
	 * @memberof MongoCollection
	 */
	public atomicSave(doc2save: TC): Promise<TC> {
		// let isUpdate = false;
		return this.getItem(doc2save._id).then((doc: TC) => {
			if (doc) {
				// isUpdate = true;
				// console.log(doc2save,doc);
				let from = Object.assign({}, doc2save);
				delete from._id;
				return this.createUpdate(from, doc);
			} else {
				return doc2save;
			}
		}).then((to) => {
			var oQuery = {
				_id: doc2save._id
			};
			let mod = Object.assign({}, to);
			// console.log("[DEV]", JSON.stringify(mod));
			delete mod._id;
			delete mod.createdOn; // ignore value because its set on first save and should never change again
			delete mod.lastModifiedOn; // ignore value because its set on save
			// console.log("[DEV]", JSON.stringify(mod));
			let fields = 0;
			for (const key in mod) {
				if (mod.hasOwnProperty(key)) {
					fields++;
				}
			}
			let SOI = Object.assign({}, oQuery, { createdOn: new Date() });
			mod.lastModifiedOn = new Date();
			// console.log("[DEV]", JSON.stringify(mod));

			// console.log("[DEV]", `${fields} fields <isUpdate:${isUpdate}> changed for ${doc2save._id + ''} in ${this.Collection.collectionName}: ${JSON.stringify(mod)}`);
			// console.log("[DEV]", JSON.stringify({ col: this.Collection.collectionName, $setOnInsert: SOI, $set: mod }));
			return fields ? this.updateOne(oQuery, { $setOnInsert: SOI, $set: mod }, { upsert: true }) : this.getItem(doc2save._id);
		});
	}

	/**
	 * passthrough updateOne method with object response
	 *
	 *
	 * @param {FilterQuery<T>} filter
	 * @param {Object} update
	 * @param {ReplaceOneOptions} [options]
	 * @returns {Promise<T>}
	 * @memberof MongoCollection
	 */
	public updateOne(filter: FilterQuery<TC>, update: Object, options?: ReplaceOneOptions): Promise<TC> {
		if (!this.Collection) {
			return Promise.reject('No Collection set!');
		}
		return this.Collection.updateOne(filter, update, options || { upsert: true }).catch((E) => {
			if (E.code == 11000) {
				console.log('[E]', '[updateOne]', `[${this.Collection.collectionName}]`, E.message, '[CATCHED]');
				return true;
			} else {
				console.log('[E]', '[updateOne]', `[${this.Collection.collectionName}]`, E.message);
				throw "Error on update One";
			}
		}).then(() => {
			return this.Collection.findOne(filter);
		});
	}

	/**
	 * passthrough updateMany method for current collection
	 *
	 * @param {FilterQuery<TC>} filter
	 * @param {Object} update
	 * @param {(CommonOptions & { upsert?: boolean })} [options]
	 * @returns {Promise<UpdateWriteOpResult>}
	 * @memberof MongoCollection
	 */
	public updateMany(filter: FilterQuery<TC>, update: Object, options?: CommonOptions & { upsert?: boolean }): Promise<UpdateWriteOpResult> {
		if (!this.Collection) {
			return Promise.reject('No Collection set!');
		}
		return this.Collection.updateMany(filter, update, options);
	}

	/**
	 * Count all Documents
	 *
	 * @returns {Promise<number>}
	 *
	 * @memberof MongoDB
	 */
	public countAll(): Promise<number> {
		return this.countItems(null);
	}

	/**
	 * Counts documents after filtering
	 *
	 * @param {FilterQuery<TC>} Filter
	 * @returns {Promise<number>}
	 * @memberof MongoCollection
	 */
	public countItems(Filter: FilterQuery<TC>): Promise<number> {
		if (!this.Collection) {
			return Promise.reject('No Collection set!');
		}
		return this.Collection.countDocuments(Filter, {});
	}

	/**
	 * Fetch all Documents
	 *
	 * @returns {Promise<TC[]>}
	 * @memberof MongoCollection
	 */
	public getAll(): Promise<TC[]> {
		return this.getItems(null);
	}

	/**
	 * get items matching the Filter
	 *
	 * @param {FilterQuery<TC>} Filter
	 * @returns {Promise<TC[]>}
	 * @memberof MongoCollection
	 */
	public getItems(Filter: FilterQuery<TC>): Promise<TC[]> {
		if (!this.Collection) {
			return Promise.reject('No Collection set!');
		}
		return this.Collection.find(Filter).toArray();
	}

	/**
	 * gets a single item by its unique _id
	 *
	 * @param {(ObjectID | string)} objectId
	 * @returns {Promise<T>}
	 *
	 * @memberof MongoDB
	 */
	public getItem(uid: ObjectID | string): Promise<TC> {
		if (!this.Collection) {
			return Promise.reject('No Collection set!');
		}
		return this.Collection.findOne({ _id: uid });
	}

	/**
	 *
	 *
	 * @param {*} [pipeline]
	 * @param {ChangeStreamOptions} [options]
	 * @returns {ChangeStream}
	 * @memberof MongoCollection
	 */
	public watch(pipeline?: any, options?: ChangeStreamOptions): ChangeStream {
		const opt = Object.assign({}, this.DEFAULT_CS_OPTION, options || {});
		return this.Collection.watch(pipeline || {}, opt);
	}

	/**
	 *
	 *
	 * @static
	 * @param {any} Items
	 * @returns {string}
	 * @memberof MongoDB
	 */
	public static generateId256(...Items): string {
		let input = Items.join('#');
		const secret = cfg.db.idSecret || "d3f4ul753cR3T";
		return createHmac('sha256', secret).update(input).digest('hex');
	}

	/**
	 *
	 *
	 * @protected
	 * @param {any} Items
	 * @returns {string}
	 * @memberof MongoDB
	 */
	protected idGenerator256(...Items): string {
		return MongoCollection.generateId256(...Items);
	}

	/**
	 *
	 *
	 * @readonly
	 * @type {string}
	 *
	 * @memberof MongoDB
	 */
	public get namespace(): string {
		return this.Collection.namespace;
	}
}
