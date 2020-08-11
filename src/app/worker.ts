require('dotenv').config();
import { Logger, Loglevel } from '../util';
import { RelayIO } from './RelayIO';
import { WorkerProcess } from './WorkerProcess';


const processType = process.argv.pop();
let Application: WorkerProcess = null;

switch (processType) {
	case 'relayio':
		Application = new RelayIO();
		break;
	default:
		Logger(Loglevel.ERROR, "worker", `Invalid module ${processType}`);
		break;
}

if (Application) {
	process.on('message', (msg: any) => {
		switch (msg) {
			case 'reboot':
				Application.destroy().then(() => {
					process.exit();
				});
				break;

			default:
				Logger(Loglevel.ERROR, "worker", `Invalid message ${msg}`);
				break;
		}
	});
}