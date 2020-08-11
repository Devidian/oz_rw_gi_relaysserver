'use strict';
import { ChildProcess, fork } from 'child_process';

import { watch as watchFS } from 'fs';
import { Server } from 'ws';
import { Logger, Loglevel } from '../util';

/**
 *
 *
 * @export
 * @class Master
 */
export class Master {

	// io stuff
	protected ioServer: Server = null;


	protected workerList: Map<string, ChildProcess> = new Map<string, ChildProcess>();

	protected flagReboot: boolean = false;
	protected flagWatchFile: Map<string, boolean> = new Map<string, boolean>();


	/**
	 * Creates an instance of Master.
	 * @memberof Master
	 */
	constructor() {
		this.setupIOServer();
		this.bootWorker('relayio');

		watchFS(__dirname, (e: string, f: string) => {
			if (f) {
				let parts = f.split('.');
				let name = parts.shift().toLowerCase();
				if (this.workerList.has(name) && (!this.flagWatchFile.has(name) || !this.flagWatchFile.get(name))) {
					Logger(Loglevel.DEBUG, '[Master]', '[watchFS]', `restarting worker ${name} due to file changes`);
					this.workerList.get(name).send("reboot");
					this.flagWatchFile.set(name, true);
				}
			}
		});
	}

	/**
	 *
	 *
	 * @protected
	 * @param {string} type
	 * @returns {Promise<ChildProcess>}
	 * @memberof Master
	 */
	protected bootWorker(type: string): Promise<ChildProcess> {
		const W: ChildProcess = fork(__dirname + '/worker', [type]);

		this.workerList.set(type, W);

		W.on("exit", (c: number, s: string) => {
			if (this.workerList.has(type)) {
				this.workerList.get(type).removeAllListeners();
				this.workerList.delete(type);
				this.flagWatchFile.set(type, false);
			}
			if (this.flagReboot) {
				Logger(Loglevel.INFO, '[Master]', `Worker[${W.pid}/${type}]: exited (reboot)`);
				if (this.workerList.size < 1) {
					Logger(Loglevel.INFO, '[Master]', `All worker shut down, exit now for reboot`);
					this.cleanExit();
				}
			} else {
				Logger(Loglevel.WARNING, '[Master]', `Worker[${W.pid}/${type}]: exited`);
				this.bootWorker(type);
			}
		});

		W.on("close", (c: number, s: string) => {
			Logger(Loglevel.WARNING, '[Master]', `Worker[${W.pid}/${type}]: closed`);
		}).on("disconnect", () => {
			Logger(Loglevel.WARNING, '[Master]', `Worker[${W.pid}/${type}]: disconnected`);
		}).on("error", (e: Error) => {
			Logger(Loglevel.WARNING, '[Master]', `Worker[${W.pid}/${type}]: error ${e.toString()}`);
		}).on("message", (msg: any) => {
			if (msg.type == "ABC") {
			} else {
				Logger(Loglevel.DEBUG, '[Master]', `Worker[${W.pid}/${type}]:`, msg);
			}
		});

		return Promise.resolve(W);
	}

	/**
	 *
	 *
	 * @protected
	 * @memberof Master
	 */
	protected setupIOServer() {
		this.ioServer = new Server({ port: Number(process.env.APP_CLI_PORT) });

		// Command Line Interface
		this.ioServer.on('connection', (ws) => {
			ws.send(JSON.stringify({ event: 'hello', content: 'Welcome to Master cli' }));
			ws.on("message", (message: string) => {
				switch (message) {
					case "reboot":
						this.flagReboot = true;
						this.workerList.forEach((cp, key, map) => {
							cp.send("reboot");
						});
						ws.send(JSON.stringify({ event: 'done' }));
						break;
				}

			});
		});
	}

	/**
	 *
	 *
	 * @protected
	 * @memberof Master
	 */
	protected cleanExit(): void {
		process.exit(0);
	}
}