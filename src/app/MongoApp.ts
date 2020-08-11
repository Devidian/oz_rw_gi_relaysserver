'use strict';
import { Logger, Loglevel, MongoDB } from '../util';
import { Db, MongoClient } from 'mongodb';


/**
 *
 *
 * @export
 * @abstract
 * @class MongoApp
 */
export abstract class MongoApp {
	protected MongoClient: MongoClient = null;
	protected MongoDatabase: Db = null;
	protected MongoFailState: string = null;

	protected isMaster: boolean = !process.connected;
	protected _isReady: boolean = false;

	/**
	 *
	 *
	 * @readonly
	 * @type {boolean}
	 * @memberof MongoApp
	 */
	public get isReady(): boolean {
		return this._isReady;
	}

	/**
	 * Creates an instance of MongoApp.
	 * @memberof MongoApp
	 */
	constructor() {
		this.mongoConnect();
	}

	/**
	 *
	 *
	 * @protected
	 * @memberof MongoApp
	 */
	protected mongoAfterConnect(): void {
		this._isReady = true;
		console.log('[I]', '[BOOT]', `${this.isMaster ? 'Master' : `Worker`} MongoDB connected! PID: ${process.pid}`);
	}

	/**
	 * Stuff to do when mongo connection was destroyed due to closed socket
	 *
	 * @protected
	 * @memberof MongoApp
	 */
	protected mongoOnSocketClose(): void {
		setTimeout(() => this.mongoConnect(), 250);
	}

	/**
	 *
	 *
	 * @protected
	 * @memberof MongoApp
	 */
	protected async mongoConnect(): Promise<void> {

		try {
			const isConnected = await MongoDB.config();
			if (!isConnected) {
				Logger(Loglevel.WARNING, 'MongoApp', `MongoDB Connection failed, please restart`);
				return;
			}
			this.mongoAfterConnect();
			this.MongoFailState = null;
			this.MongoClient = MongoDB.client;
			this.MongoDatabase = MongoDB.client.db(process.env.MONGODB_DB);
		} catch (error) {
			this.MongoFailState = "Failed to connect to MongoCollection";
			Logger(Loglevel.ERROR, 'MongoApp', error);
			setTimeout(() => this.mongoConnect(), 1000);
		}

	}
}