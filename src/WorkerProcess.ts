
/**
 *
 *
 * @export
 * @abstract
 * @class WorkerProcess
 */
export abstract class WorkerProcess {
	protected abstract run(): void;
	public abstract destroy(): Promise<boolean>;
}