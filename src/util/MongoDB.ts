import { Logger } from "./Logger";
import { Loglevel } from "./enums";
import { basename } from "path";
import { MongoClient } from "mongodb";

const options = {
	native_parser: true,
	useNewUrlParser: true,
	useUnifiedTopology: true,
	// ssl: false,
	appname: process.env.MONGODB_APPNAME || "NodeApp"
};

export class MongoDB {
	static client: MongoClient;

	static async config(): Promise<boolean> {
		Logger(Loglevel.VERBOSE, basename(__filename, '.js'), `MongoDB Setup`);
		if (!process.env.MONGODB_URI) {
			Logger(Loglevel.ERROR, basename(__filename, '.js'), `please set env MONGODB_URI`);
			return false;
		}
		try {
			this.client = await MongoClient.connect(process.env.MONGODB_URI as string, options);
			Logger(Loglevel.VERBOSE, basename(__filename, '.js'), `MongoDB connection established`);

			return true;

		} catch (error) {
			Logger(Loglevel.ERROR, basename(__filename, '.js'), error);
			return false;
		}
	}
}