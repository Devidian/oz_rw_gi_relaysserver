import { cfg } from './config';
import * as WebSocket from "ws";

var args = process.argv.slice(2);
var command = args.shift();

if (cfg.cli.commands.indexOf(command) < 0) {
	console.log('illegal command, use one of these:', cfg.cli.commands);
	process.exit();
}

console.log('Starting IO Client for sending command <%s> to Master', command);

var IOClient: WebSocket = new WebSocket(`ws://localhost:${cfg.master.ioport}/`);

IOClient.on('disconnect', function () {
	console.log('Disconnected, bye!');
	IOClient.removeAllListeners();
	process.exit(0);
});

interface CLIMessage {
	event: string,
	[key: string]: any
}

IOClient.on('connect', function () {
	console.log('Successful connected to Master');
	IOClient.send(command);
	IOClient.on('message', function (msg: CLIMessage) {
		console.log(`Master: ${msg}`);
		switch (msg.event) {
			case 'hello':

				break;
			case 'done':
				console.log('Done! Closeing connection to Master.');
				IOClient.close();
				break;
			default:
				break;
		}
		IOClient.close();
	});
});