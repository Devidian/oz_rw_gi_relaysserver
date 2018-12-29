import { WorkerProcess } from "./WorkerProcess";
import { cfg, LOGTAG } from "./config";
import { Server } from "ws";
import * as WebSocket from "ws";
import { ClientRequest, IncomingMessage } from "http";

enum GI_EVENT {
    BC_MESSAGE = "broadcastMessage",
    DC_MESSAGE = "directContactMessage",
};

interface GIMessage {
    event: GI_EVENT,
    payload: any,
    [key: string]: any
};

interface ChatMessage {
    createdOn: Date,
    chatVersion: number,
    chatContent: string,
    chatChannel: string,
    playerName: string,
    playerUID: string,  // should be (long) number but thats too long for JavaScript right now...
    sourceName: string,
    sourceIP: string,
    sourceVersion: string
}

export class RelayIO extends WorkerProcess {
    protected ioServer: Server = null;

    constructor() {
        super();
        this.setupIOServer();
    }

    /**
     *
     *
     * @protected
     * @memberof RelayIO
     */
    protected run(): void {
        // throw new Error("Method not implemented.");
    }

    /**
     *
     *
     * @returns {Promise<boolean>}
     * @memberof RelayIO
     */
    public destroy(): Promise<boolean> {
        // throw new Error("Method not implemented.");
        return Promise.resolve(true);
    }

    /**
     *
     *
     * @protected
     * @memberof RelayIO
     */
    protected setupIOServer(): void {
        this.ioServer = new Server({ port: cfg.relayio.port });
        !cfg.log.info ? null : console.log(LOGTAG.INFO, "[RelayIO]", "Setting up server");
        this.ioServer.on('connection', (ws) => {
            !cfg.log.debug ? null : console.log(LOGTAG.DEBUG, "[RelayIO]", `Client connected`, ws.url);
            ws.on("message", (message: any) => {
                let decodedMessage: GIMessage = JSON.parse(message);
                // !cfg.log.debug ? null : console.log(LOGTAG.DEV, `[ws::onMessage]`, message, decodedMessage);
                switch (decodedMessage.event) {
                    case GI_EVENT.BC_MESSAGE:
                        !cfg.log.info ? null : console.log(LOGTAG.INFO, `[ws::onMessage]`, `Got BC message, sending to <${this.ioServer.clients.size}> clients`);
                        this.ioServer.clients.forEach((clientWS) => {
                            !(clientWS.readyState === WebSocket.OPEN) ? null : clientWS.send(JSON.stringify({ event: GI_EVENT.BC_MESSAGE, payload: decodedMessage.payload }));
                        });
                        break;
                    default:
                        !cfg.log.warn ? null : console.log(LOGTAG.WARN, `[ws::onMessage]`, `Unknown message event <${decodedMessage.event}>`);
                        break;
                }
            });
            ws.on("error", (err: Error) => {
                !cfg.log.debug ? null : console.log(LOGTAG.DEBUG, `[ws::onError]`, err);
            });
            ws.on("unexpected-response", (req: ClientRequest, response: IncomingMessage) => {
                !cfg.log.debug ? null : console.log(LOGTAG.DEBUG, '[ws:ur]', req, response);
            });
            ws.on("close", (x, y) => {
                !cfg.log.debug ? null : console.log(LOGTAG.DEBUG, '[ws:close]', ws.url + " has left ", JSON.stringify(x), JSON.stringify(y));
            });
            ws.on("open", () => {
                !cfg.log.debug ? null : console.log(LOGTAG.DEBUG, "[ws:open]");
            });
            ws.on("ping", (data) => {
                !cfg.log.debug ? null : console.log(LOGTAG.DEBUG, "[ws:ping]", data);
            });
            ws.on("pong", (data) => {
                !cfg.log.debug ? null : console.log(LOGTAG.DEBUG, "[ws:pong]", data);
            });

            ws.on("upgrade", (response: IncomingMessage) => {
                !cfg.log.debug ? null : console.log(LOGTAG.DEBUG, "[ws:upgrade]", response);
            });
            // ws.send(JSON.stringify({ tag: "HelloWorld" }));
            // ws.send('something');
        });
        this.ioServer.on("error", (err: Error) => {
            console.log(LOGTAG.ERROR, `[ioServer::onError]`, err);
        })
    }
}