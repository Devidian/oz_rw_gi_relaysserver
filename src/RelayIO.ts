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

interface RisingWorldServer{
    isDedicated: boolean,
    name: string,
    playerList: RisingWorldPlayer[]
}

interface RisingWorldPlayer{
    id64: string,   // long id, cant be handled as number in javascript right now
    name: string    // The ingame name of this player
}

interface AdvancedWebSocket extends WebSocket {
    id: number,
    rwInfo: RisingWorldServer
}

export class RelayIO extends WorkerProcess {
    protected ioServer: Server = null;
    protected connectionIndex: number = 0;

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
        this.ioServer.on('connection', (ws: AdvancedWebSocket, req: IncomingMessage) => {
            ws.id = this.connectionIndex++;
            !cfg.log.debug ? null : console.log(LOGTAG.DEBUG, "[RelayIO]", `Client connected from <${req.connection.remoteAddress}> <ID:${ws.id}>`);
            ws.on("message", (message: any) => {
                let decodedMessage: GIMessage = JSON.parse(message);
                // !cfg.log.debug ? null : console.log(LOGTAG.DEV, `[ws::onMessage]`, message, decodedMessage);
                switch (decodedMessage.event) {
                    case GI_EVENT.BC_MESSAGE:
                        !cfg.log.info ? null : console.log(LOGTAG.INFO, `[ws::onMessage]`, `Got BC message from <ID:${ws.id}>, sending to <${this.ioServer.clients.size}> clients`);
                        this.ioServer.clients.forEach((clientWS) => {
                            !(clientWS.readyState === WebSocket.OPEN) ? null : clientWS.send(JSON.stringify({ event: GI_EVENT.BC_MESSAGE, payload: decodedMessage.payload }));
                        });
                        break;
                    default:
                        !cfg.log.warn ? null : console.log(LOGTAG.WARN, `[ws::onMessage]`, `Unknown message event <${decodedMessage.event}> from <ID:${ws.id}>`);
                        break;
                }
            });
            ws.on("error", (err: Error) => {
                !cfg.log.debug ? null : console.log(LOGTAG.DEBUG, `[ws::onError]`, err);
            });
            ws.on("unexpected-response", (req: ClientRequest, response: IncomingMessage) => {
                !cfg.log.debug ? null : console.log(LOGTAG.DEBUG, '[ws:ur]', req, response);
            });
            ws.on("close", (code, reason) => {
                !cfg.log.debug ? null : console.log(LOGTAG.DEBUG, '[ws:close]', `Client <ID:${ws.id}> disconnected, Code: <${code}> Reason: <${reason}>`);
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