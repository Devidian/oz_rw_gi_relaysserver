import { MongoClientOptions } from "mongodb";

/**
 *
 *
 * @export
 * @interface MongoConfig
 */
export interface MongoConfig {
	url: string,
	db: string,
	options: MongoClientOptions
}

/**
 * 
 *
 * @export
 * @interface ConfigDB
 */
export interface ConfigDB {
	idSecret: string
}