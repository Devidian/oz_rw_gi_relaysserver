import { MongoApp } from "./MongoApp"
/**
 *
 *
 * @export
 * @abstract
 * @class WorkerProcess
 */
export abstract class WorkerProcess extends MongoApp {
	protected abstract run(): void;
	public abstract destroy(): Promise<boolean>;
}