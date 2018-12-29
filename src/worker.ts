import { RelayIO } from './RelayIO';
import { WorkerProcess } from './WorkerProcess';
import { cfg, LOGTAG } from './config';


const processType = process.argv.pop();
let Application: WorkerProcess = null;

switch (processType) {
	case 'relayio':
		Application = new RelayIO();
		break;
	default:
		!cfg.log.warn ? null : console.log(LOGTAG.WARN, "[worker]", 'Invalid module');
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
				console.log(LOGTAG.ERROR, "[worker]", `Invalid message ${msg}`);
				break;
		}
	});
}