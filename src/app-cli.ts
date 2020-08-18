import { } from "ws";
import { CLICommand, Logger, Loglevel } from "./util";
const WebSocketClient = require('ws');

const args = process.argv.slice(2);
const command: CLICommand = args.shift() as CLICommand;

Logger(Loglevel.INFO, 'app-cli', `Starting IO Client for sending command <${command}> to Master`);

var IOClient = new WebSocketClient(`ws://localhost:${process.env.APP_CLI_PORT}/`);

IOClient.on('disconnect', function () {
	Logger(Loglevel.INFO, 'app-cli', 'Disconnected, bye!');
	IOClient.removeAllListeners();
	process.exit(0);
});

interface CLIMessage {
	event: string,
	[key: string]: any
}

IOClient.on('connect', function () {
	Logger(Loglevel.INFO, 'app-cli', 'Successful connected to Master');
	IOClient.send(command);
	IOClient.on('message', function (msg: CLIMessage) {
		Logger(Loglevel.VERBOSE, 'app-cli', `Master: ${msg}`);
		switch (msg.event) {
			case 'hello':

				break;
			case 'done':
				Logger(Loglevel.INFO, 'app-cli', 'Done! Closeing connection to Master.');
				IOClient.close();
				break;
			default:
				break;
		}
		IOClient.close();
	});
});

IOClient.on('error', error => {
	Logger(Loglevel.ERROR, 'app-cli', 'Master is not running', error.message);
});
