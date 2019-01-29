import { Client, TextChannel, Guild, GuildChannel, MessageOptions, Attachment, RichEmbed, WebhookMessageOptions } from "discord.js";
import { ClientRequest, IncomingMessage } from "http";
import * as WebSocket from "ws";
import { Server } from "ws";
import { cfg, LOGTAG } from "./config";
import { WorkerProcess } from "./WorkerProcess";
import * as jdenticon from "jdenticon";
import { PlayerCollection } from "./mongo/collections/PlayerCollection";
import { ChannelCollection } from "./mongo/collections/ChannelCollection";
import { RisingWorldPlayer, EmptyPlayer } from "./mongo/models/RisingWorldPlayer";
import { RisingWorldChannel, defaultChannel } from "./mongo/models/RisingWorldChannel";
import { createHmac } from "crypto";

enum GI_EVENT {
	BC_MESSAGE = "broadcastMessage",
	DC_MESSAGE = "directContactMessage",
	PLAYER_REGISTER = "registerPlayer",
	PLAYER_UNREGISTER = "unregisterPlayer",
	PLAYER_ONLINE = "playerOnline",
	PLAYER_OFFLINE = "playerOffline",
	PLAYER_JOINCH = "playerJoinChannel",
	PLAYER_LEAVECH = "playerLeaveChannel",
	PLAYER_CLOSECH = "playerCloseChannel",
	PLAYER_CREATECH = "playerCreateChannel",
	PLAYER_OVERRIDE_CHANGE = "playerOverrideChange",
	PLAYER_RESPONSE_ERROR = "playerResponseError",
	PLAYER_RESPONSE_SUCCESS = "playerResponseSuccess",
	PLAYER_RESPONSE_INFO = "playerResponseInfo"
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

interface PlayerMessage {
	playerName: string,
	playerUID: string
}

/**
 *
 *
 * @interface PlayerRegisterMessage
 * @extends {PlayerMessage}
 */
interface PlayerRegisterMessage extends PlayerMessage {
	register: boolean
}

interface PlayerUnregisterMessage extends PlayerMessage {
	unregister: boolean
}

interface PlayerRequestDataMessge extends PlayerMessage {

}

interface PlayerOfflineMessge extends PlayerMessage {

}

interface PlayerCreateChannelMessage extends PlayerMessage {
	channel: string,
	password?: string
}

interface PlayerJoinChannelMessage extends PlayerMessage {
	channel: string,
	password?: string
}

interface PlayerLeaveChannelMessage extends PlayerMessage {
	channel: string
}

interface PlayerRemoveChannelMessage extends PlayerMessage {
	channel: string
}

interface PlayerOverrideChangeMessage extends PlayerMessage {
	override: boolean
}

interface RisingWorldServer {
	isDedicated: boolean,
	name: string,
	playerList: RisingWorldPlayer[]
}



interface AdvancedWebSocket extends WebSocket {
	id: number,
	rwInfo: RisingWorldServer
}

export class RelayIO extends WorkerProcess {
	protected ioServer: Server = null;
	protected connectionIndex: number = 0;
	protected DiscordBot: Client = null;

	public static CHAT_VERSION = 2;

	protected static Players: Map<string, RisingWorldPlayer> = new Map<string, RisingWorldPlayer>();
	protected static Channels: Map<string, RisingWorldChannel> = new Map<string, RisingWorldChannel>();

	protected static PlayerOrigins: Map<string, AdvancedWebSocket> = new Map<string, AdvancedWebSocket>();

	// Collections
	protected playerCol: PlayerCollection = null;
	protected channelCol: ChannelCollection = null;

	constructor() {
		super();
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
     * @protected
     * @memberof RelayIO
     */
	protected loadDataFromDatabase(): void {
		this.channelCol.getAll().then((ChannelList: RisingWorldChannel[]) => {
			ChannelList.forEach((Channel) => {
				RelayIO.Channels.set(Channel._id + '', Channel);
			});
			this.defaultChannels();
		});
		this.playerCol.getAll().then((PlayerList: RisingWorldPlayer[]) => {
			PlayerList.forEach((Player) => {
				RelayIO.Players.set(Player._id + '', Player);
			});
		});
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

	protected setupDiscordBot(): void {
		if (!cfg.discord || !cfg.discord.enabled) {
			!cfg.log.info ? null : console.log(LOGTAG.INFO, "[RelayIO:setupDiscordBot]", `Discord not enabled.`);
			return;
		} else {
			this.DiscordBot = new Client();
			this.DiscordBot.on('ready', () => {
				!cfg.log.info ? null : console.log(LOGTAG.INFO, "[RelayIO:setupDiscordBot]", `Logged in as ${this.DiscordBot.user.tag}!`);
				// const DebugMessage: ChatMessage = {
				//     chatChannel: "global",
				//     chatContent: "Debug test",
				//     playerName: "Test",
				//     chatVersion: 1,
				//     createdOn: new Date(),
				//     playerUID: null,
				//     sourceIP: null,
				//     sourceName: "Debug",
				//     sourceVersion: "0"
				// };
				// !cfg.log.debug ? null : this.sendBCMessageToDiscord(DebugMessage);
			});
			this.DiscordBot.on('message', msg => {
				if (!msg.guild) return;
				if (msg.author.bot) {
					return;
				}
				// console.log(msg);
				const CH: TextChannel = msg.channel as TextChannel;

				// todo: check if channel is secure!

				// const message:string = msg.content;
				// const messageId: string = msg.id;
				// const channel:string =  CH.name;
				// const userName: string = msg.author.username;
				const ChatMessage: ChatMessage = {
					chatChannel: CH.name,
					chatContent: msg.content,
					createdOn: new Date(msg.createdTimestamp),
					chatVersion: RelayIO.CHAT_VERSION,
					playerName: msg.author.username + "#" + msg.author.discriminator,
					playerUID: msg.author.id,
					sourceName: "Discord",
					sourceIP: null,
					sourceVersion: null
				};
				this.sendBCMessageToRisingWorld(ChatMessage, ChatMessage.sourceName);
			});
			this.DiscordBot.login(cfg.discord.token);
		}
	}

    /**
     *
     *
     * @protected
     * @param {ChatMessage} Message
     * @param {AdvancedWebSocket} ws
     * @memberof RelayIO
     */
	protected broadcastMessage(Message: ChatMessage, ws: AdvancedWebSocket): void {
		if (Message.chatVersion == 1) {
			// Backwards-compatible
			this.sendBCMessageToRisingWorld(Message, "WS:" + ws);
			if (!RelayIO.Channels.has(Message.chatChannel) || !RelayIO.Channels.get(Message.chatChannel).secure) {
				// only send to Discord if channel is unknown or not secure
				this.sendBCMessageToDiscord(Message);
			}
		} else {
			const player = RelayIO.Players.get(Message.playerUID);
			// Check if channel exists
			if (RelayIO.Channels.has(Message.chatChannel)) {
				// Channel OK
				const ch = RelayIO.Channels.get(Message.chatChannel);
				if (!player.channels.includes(ch._id)) {
					ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_RESPONSE_ERROR, payload: player, subject: Message.chatChannel, errorCode: "RELAY_CHANNEL_NOTMEMBER" }));
				} else if (!ch.secure) {
					this.sendBCMessageToRisingWorld(Message, "WS:" + ws);
					this.sendBCMessageToDiscord(Message);
				} else {
					this.sendBCMessageToRisingWorld(Message, "WS:" + ws);
				}
			} else {
				// response invalid channel
				ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_RESPONSE_ERROR, payload: player, subject: Message.chatChannel, errorCode: "RELAY_CHANNEL_UNKNOWN" }));
			}
		}
	}

    /**
     *
     *
     * @protected
     * @param {ChatMessage} Message
     * @param {string} [source="unknown"]
     * @memberof RelayIO
     */
	protected sendBCMessageToRisingWorld(Message: ChatMessage, source: string = "unknown"): void {
		!cfg.log.info ? null : console.log(LOGTAG.INFO, `[ws::sendBCMessageToRisingWorld]`, `Got BC message from <ID:${source}>, sending to <${this.ioServer.clients.size}> clients`);
		this.ioServer.clients.forEach((clientWS) => {
			!(clientWS.readyState === WebSocket.OPEN) ? null : clientWS.send(JSON.stringify({ event: GI_EVENT.BC_MESSAGE, payload: Message }));
		});
	}

    /**
     *
     *
     * @protected
     * @param {ChatMessage} Message
     * @memberof RelayIO
     */
	protected sendBCMessageToDiscord(Message: ChatMessage): void {
		if (this.DiscordBot && this.DiscordBot.status === 0) {

			// this.DiscordBot.channels.find("name", Message.chatChannel)
			this.DiscordBot.guilds.forEach((Guild: Guild) => {
				Guild.channels.filter((gc) => gc.name == Message.chatChannel).forEach((GC: GuildChannel) => {
					if (GC.type == "text") {
						// const embed = new RichEmbed();
						const TC: TextChannel = (GC as TextChannel);
						const WebHookName = 'RW-GI-BOT-' + TC.name.toUpperCase();

						TC.fetchWebhooks().then((WHC) => {
							const WH = WHC.filter((wh) => wh.name === WebHookName).first();
							if (!WH) {
								// !cfg.log.debug ? null : console.log(LOGTAG.DEBUG, "[sendBCMessageToDiscord]", `creating web-hook ${WebHookName}`);
								return TC.createWebhook(WebHookName, jdenticon.toPng(process.hrtime().join("#"), 256));
							} else {
								// !cfg.log.debug ? null : console.log(LOGTAG.DEBUG, "[sendBCMessageToDiscord]", `web-hook ${WebHookName} found`);
								return WH;
							}
						}).then((WH) => {
							// const Avatar = jdenticon.toPng(Message.playerUID, 256);
							// const b64Avatar = "data:image/png;base64," + encodeURIComponent(Avatar.toString('base64'));
							const AvatarURL = "https://api.adorable.io/avatars/128/" + Message.playerUID;
							const WHO: WebhookMessageOptions = {
								username: Message.playerName,
								avatarURL: AvatarURL
							};
							WH.sendMessage(Message.chatContent, WHO);
						}).catch(e => {
							console.log(LOGTAG.ERROR, e);
						});
						// embed.setAuthor(Message.playerName);
						// const msg: MessageOptions = {
						//     embed: embed
						// };
						// (GC as TextChannel).send(Message.chatContent, msg);
						// .send({ content: Message.chatContent, author: { name: Message.playerName } }).then(M => {

						// })
					}
				});
			})
		} else {
			!cfg.log.debug ? null : console.log("[sendBCMessageToDiscord]", `Discord status is ${this.DiscordBot.status}`);
		}
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
			!cfg.log.debug ? null : console.log(LOGTAG.DEBUG, "[RelayIO]", `Client connected from <${req.headers['x-forwarded-for'] || req.connection.remoteAddress}> <ID:${ws.id}>`);
			ws.on("message", (message: any) => {
				let decodedMessage: GIMessage = JSON.parse(message);
				// !cfg.log.debug ? null : console.log(LOGTAG.DEV, `[ws::onMessage]`, message, decodedMessage);
				switch (decodedMessage.event) {
					case GI_EVENT.BC_MESSAGE:
						this.broadcastMessage(decodedMessage.payload, ws);
						break;
					case GI_EVENT.PLAYER_REGISTER:
						this.registerPlayer(ws, decodedMessage.payload);
						break;
					case GI_EVENT.PLAYER_UNREGISTER:
						this.unregisterPlayer(ws, decodedMessage.payload);
						break;
					case GI_EVENT.PLAYER_ONLINE:
						this.playerOnline(ws, decodedMessage.payload);
						break;
					case GI_EVENT.PLAYER_JOINCH:
						this.playerJoinChannel(ws, decodedMessage.payload);
						break;
					case GI_EVENT.PLAYER_LEAVECH:
						this.playerLeaveChannel(ws, decodedMessage.payload);
						break;
					case GI_EVENT.PLAYER_CLOSECH:
						this.playerCloseChannel(ws, decodedMessage.payload);
						break;
					case GI_EVENT.PLAYER_CREATECH:
						this.playerCreateChannel(ws, decodedMessage.payload);
						break;
					case GI_EVENT.PLAYER_OVERRIDE_CHANGE:
						this.playerOverrideChange(ws, decodedMessage.payload);
						break;
					case GI_EVENT.PLAYER_OFFLINE:
						this.playerOffline(ws, decodedMessage.payload);
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

    /**
     *
     *
     * @protected
     * @param {AdvancedWebSocket} ws
     * @param {PlayerRegisterMessage} data
     * @memberof RelayIO
     */
	protected registerPlayer(ws: AdvancedWebSocket, data: PlayerRegisterMessage): void {
		if (data.register) {
			if (!RelayIO.Players.has(data.playerUID)) {
				// Player unknown - create
				RelayIO.Players.set(data.playerUID, this.getPlayer(data.playerUID, data.playerName));
			}
			const Player: RisingWorldPlayer = RelayIO.Players.get(data.playerUID);
			if (Player.saveSettings) {
				ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_RESPONSE_INFO, payload: Player, infoCode: "RELAY_INFO_REGISTERED" }));
				// Already set
			} else {
				Player.saveSettings = true;
				ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_RESPONSE_SUCCESS, payload: Player, successCode: "RELAY_SUCCESS_REGISTER" }));
			}
			// ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_REGISTER, payload: Player }));

			// Save changes
			this.playerCol.save(Player).then((P) => {
				console.log(LOGTAG.DEBUG, "[registerPlayer]", `Player ${data.playerName} successfully registred and saved!`);
			}).catch(e => console.log);
		}
	}

    /**
     *
     *
     * @protected
     * @param {AdvancedWebSocket} ws
     * @param {PlayerUnregisterMessage} data
     * @memberof RelayIO
     */
	protected unregisterPlayer(ws: AdvancedWebSocket, data: PlayerUnregisterMessage): void {
		if (data.unregister) {
			if (!RelayIO.Players.has(data.playerUID)) {
				// Player unknown - create
				RelayIO.Players.set(data.playerUID, this.getPlayer(data.playerUID, data.playerName));
			}
			const Player: RisingWorldPlayer = RelayIO.Players.get(data.playerUID);

			if (Player.channels.length > 0) {
				let hasOwnedChannels = false;
				Player.channels.forEach(chId => {
					hasOwnedChannels = hasOwnedChannels || RelayIO.Channels.get(chId).ownerId == Player._id;
				});
				if (hasOwnedChannels) {
					// A Channel owner must delete his channels before he can unregister
					ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_RESPONSE_ERROR, payload: Player, errorCode: "RELAY_UNREGISTER_CHOWNER" }));
					return;
				}
			}

			if (Player.saveSettings) {
				Player.saveSettings = false;
				ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_RESPONSE_SUCCESS, payload: Player, successCode: "RELAY_SUCCESS_UNREGISTER" }));
			} else {
				// Already unset
				ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_RESPONSE_INFO, payload: Player, infoCode: "RELAY_INFO_UNREGISTERED" }));
			}
			// ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_UNREGISTER, payload: Player }));

			// Save changes
			this.playerCol.hardRemove({ _id: Player._id }).then((r) => {
				console.log(LOGTAG.DEBUG, "[registerPlayer]", `Player ${data.playerName} successfully unregistred and deleted!`);
			}).catch(e => console.log);
		}
	}

    /**
     *
     *
     * @protected
     * @param {AdvancedWebSocket} ws
     * @param {PlayerJoinChannelMessage} data
     * @returns {void}
     * @memberof RelayIO
     */
	protected playerJoinChannel(ws: AdvancedWebSocket, data: PlayerJoinChannelMessage): void {
		if (!RelayIO.Players.has(data.playerUID)) {
			// Player unknown - create
			RelayIO.Players.set(data.playerUID, this.getPlayer(data.playerUID, data.playerName));
		}
		const Player: RisingWorldPlayer = RelayIO.Players.get(data.playerUID);

		if (!RelayIO.Channels.has(data.channel)) {
			!cfg.log.debug ? null : console.log(LOGTAG.DEBUG, "[playerJoinChannel]", `Player ${Player.name} tried to join unknown channel ${data.channel}!`);
			ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_RESPONSE_ERROR, payload: Player, subject: data.channel, errorCode: "RELAY_CHANNEL_UNKNOWN" }));
			return;
		}

		const Channel: RisingWorldChannel = RelayIO.Channels.get(data.channel);

		const secret = cfg.db.idSecret || "d3f4ul753cR3T";
		const hash = Channel.secure ? createHmac('sha256', secret).update(data.password).digest('hex') : null;

		if (!Channel.secure || Channel.secure && Channel.password == hash) {
			// Join success
			if (!Player.channels.includes(Channel._id)) {
				Player.channels.push(Channel._id);
				if (Player.saveSettings) {
					// Save changes
					this.playerCol.save(Player).then((P) => {
						!cfg.log.debug ? null : console.log(LOGTAG.DEBUG, "[playerJoinChannel]", `Player ${P.name} successfully joined ${Channel._id} and settings saved!`);
					}).catch(e => console.log);
				}
			}

			ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_JOINCH, payload: Player }));
			ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_RESPONSE_SUCCESS, payload: Player, subject: data.channel, successCode: "RELAY_JOIN_SUCCESS" }));
		} else if (Channel.password !== hash) {
			// password incorrect
			ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_RESPONSE_ERROR, payload: Player, subject: data.channel, errorCode: "RELAY_JOIN_NOACCESS" }));
		}

	}

    /**
     *
     *
     * @protected
     * @param {AdvancedWebSocket} ws
     * @param {PlayerLeaveChannelMessage} data
     * @returns {void}
     * @memberof RelayIO
     */
	protected playerLeaveChannel(ws: AdvancedWebSocket, data: PlayerLeaveChannelMessage): void {
		if (!RelayIO.Players.has(data.playerUID)) {
			// Player unknown - create
			RelayIO.Players.set(data.playerUID, this.getPlayer(data.playerUID, data.playerName));
		}
		const Player: RisingWorldPlayer = RelayIO.Players.get(data.playerUID);

		if (!RelayIO.Channels.has(data.channel)) {
			ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_RESPONSE_ERROR, payload: Player, subject: data.channel, errorCode: "RELAY_CHANNEL_UNKNOWN" }));
			return;
		}
		const Channel: RisingWorldChannel = RelayIO.Channels.get(data.channel);

		if (Channel.ownerId == Player._id) {
			ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_RESPONSE_ERROR, payload: Player, subject: data.channel, errorCode: "RELAY_LEAVE_OWNER" }));
			return;
		}

		if (Player.channels.includes(Channel._id)) {
			Player.channels.splice(Player.channels.indexOf(Channel._id), 1);
			if (Player.saveSettings) {
				// Save changes
				this.playerCol.save(Player).then((P) => {
					console.log(LOGTAG.DEBUG, "[playerLeaveChannel]", `Player ${P.name} successfully left ${Channel._id} and settings saved!`);
				}).catch(e => console.log);
			}
			ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_RESPONSE_SUCCESS, payload: Player, subject: data.channel, successCode: "RELAY_LEAVE_SUCCESS" }));
		} else {
			// Player is not in channel - just send Player object back...
		}

		ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_LEAVECH, payload: Player }));

	}

    /**
     * forbidden: all channel names that begin with <global>
     *
     * @protected
     * @param {AdvancedWebSocket} ws
     * @param {PlayerCreateChannelMessage} data
     * @memberof RelayIO
     */
	protected playerCreateChannel(ws: AdvancedWebSocket, data: PlayerCreateChannelMessage): void {
		const Player: RisingWorldPlayer = this.getPlayer(data.playerUID, data.playerName);
		const chName: string = data.channel.toLowerCase();
		const chPass: string = data.password || null;

		if(!Player.saveSettings){
			ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_RESPONSE_ERROR, payload: Player, subject: chName, errorCode: "RELAY_CREATE_NOTREGISTERED" }));
			return;
		}

		if (chName.startsWith('global')) {
			ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_RESPONSE_ERROR, payload: Player, subject: chName, errorCode: "RELAY_CREATE_NOGLOBAL" }));
			return;
		}

		if (chName.length < 3 || chName.length > 20) {
			ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_RESPONSE_ERROR, payload: Player, subject: chName, errorCode: "RELAY_CREATE_LENGTH" }));
			return;
		}

		if (RelayIO.Channels.has(chName)) {
			ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_RESPONSE_ERROR, payload: Player, subject: chName, errorCode: "RELAY_CREATE_EXISTS" }));
			return;
		}

		const ch: RisingWorldChannel = Object.assign({}, defaultChannel, { _id: chName, description: "Channel created by " + Player.name });
		ch.ownerId = Player._id;
		if (chPass) {
			const secret = cfg.db.idSecret || "d3f4ul753cR3T";
			ch.secure = true;
			ch.password = createHmac('sha256', secret).update(chPass).digest('hex');
		}

		this.channelCol.save(ch).then(Channel => {
			if(!Channel){
				console.log(LOGTAG.WARN,"[playerCreateChannel]", "No channel returned after save");
				return;
			}
			RelayIO.Channels.set(chName, ch);
			console.log(LOGTAG.DEBUG, "[playerCreateChannel]", `Channel ${Channel._id} added and saved!`);
			Player.channels.push(chName);

			ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_RESPONSE_SUCCESS, payload: Player, subject: chName, successCode: "RELAY_CREATE_SUCCESS" }));
			if (Player.saveSettings) {
				this.playerCol.save(Player).then((P) => {
					console.log(LOGTAG.DEBUG, "[playerCreateChannel]", `Player ${P.name} successfully joined ${Channel._id} and settings saved!`);
				}).catch(e => console.log);
			}

		}).catch(e => console.log);
	}

	/**
	 *
	 *
	 * @protected
	 * @param {AdvancedWebSocket} ws
	 * @param {PlayerRemoveChannelMessage} data
	 * @returns {void}
	 * @memberof RelayIO
	 */
	protected playerCloseChannel(ws: AdvancedWebSocket, data: PlayerRemoveChannelMessage): void {
		const Player: RisingWorldPlayer = this.getPlayer(data.playerUID, data.playerName);
		const chName: string = data.channel.toLowerCase();

		if (!RelayIO.Channels.has(chName)) {
			ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_RESPONSE_ERROR, payload: Player, subject: chName, errorCode: "RELAY_CH_CLOSE_NOTEXISTS" }));
			return;
		}
		const Channel = RelayIO.Channels.get(chName);
		if (Channel.ownerId != Player._id) {
			ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_RESPONSE_ERROR, payload: Player, subject: chName, errorCode: "RELAY_CH_CLOSE_NOTOWNER" }));
			return;
		}

		this.channelCol.hardRemove({ _id: Channel._id }).then(r => {
			if (r.deletedCount) {
				RelayIO.Channels.delete(chName);
				Player.channels.splice(Player.channels.indexOf(Channel._id), 1);
				ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_RESPONSE_SUCCESS, payload: Player, subject: chName, successCode: "RELAY_CH_CLOSE_SUCCESS" }));
				// Go through all Players
				RelayIO.Players.forEach(OtherPlayer => {
					if (OtherPlayer.channels.includes(Channel._id)) {
						OtherPlayer.channels.splice(OtherPlayer.channels.indexOf(Channel._id), 1);
						if (OtherPlayer.saveSettings) {
							this.playerCol.save(OtherPlayer).then((P) => {
								console.log(LOGTAG.DEBUG, "[playerCloseChannel]", `Player ${P.name} successfully left ${Channel._id} because it was closed!`);
							}).catch(e => console.log);
						}
						if (OtherPlayer.online) {
							const origin = RelayIO.PlayerOrigins.get(OtherPlayer._id);
							if (origin) {
								origin.send(JSON.stringify({ event: GI_EVENT.PLAYER_RESPONSE_ERROR, payload: OtherPlayer, subject: chName, errorCode: "RELAY_CH_CLOSED" }));
							}
						}
					}
				});
			} else {
				console.log(LOGTAG.ERROR, `Channel ${Channel._id} could not be deleted from database`);
			}
		}).catch(e => console.log);
	}

	/**
	 *
	 *
	 * @protected
	 * @param {AdvancedWebSocket} ws
	 * @param {PlayerOverrideChangeMessage} data
	 * @memberof RelayIO
	 */
	protected playerOverrideChange(ws: AdvancedWebSocket, data: PlayerOverrideChangeMessage): void {
		const Player: RisingWorldPlayer = this.getPlayer(data.playerUID, data.playerName);
		Player.override = data.override;
		ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_OVERRIDE_CHANGE, subject: Player.override, payload: Player }));
		this.playerCol.save(Player).then((P) => {
			console.log(LOGTAG.DEBUG, "[playerOverrideChange]", `Player ${P.name} cahnged override and settings saved!`);
		}).catch(e => console.log);
	}

    /**
     *
     *
     * @protected
     * @param {AdvancedWebSocket} ws
     * @param {PlayerOfflineMessge} data
     * @memberof RelayIO
     */
	protected playerOffline(ws: AdvancedWebSocket, data: PlayerOfflineMessge): void {
		if (RelayIO.Players.has(data.playerUID)) {
			const Player = RelayIO.Players.get(data.playerUID);
			if (!Player.saveSettings && Player.channels.length < 1) {
				// Player has no channels and not set saveSettings to true - we will delete him/her
				RelayIO.Players.delete(Player._id);
			}
			// Player has saveSettings=true or at least one channel that he joined
			Player.online = false;
			if (Player.saveSettings) {
				this.playerCol.save(Player).then((P) => {
					console.log(LOGTAG.DEBUG, "[playerOffline]", `Player ${P.name} is now offline and settings saved!`);
				}).catch(e => console.log);
			}
		}
	}

    /**
     *
     *
     * @protected
     * @param {AdvancedWebSocket} ws
     * @param {PlayerRequestDataMessge} data
     * @memberof RelayIO
     */
	protected playerOnline(ws: AdvancedWebSocket, data: PlayerRequestDataMessge): void {
		const Player: RisingWorldPlayer = this.getPlayer(data.playerUID, data.playerName);
		Player.online = true;
		RelayIO.PlayerOrigins.set(data.playerUID, ws); // used for direct messages in future and for updates on channels like close, kick or ban
		if (Player.saveSettings) {
			this.playerCol.save(Player).then((P) => {
				console.log(LOGTAG.DEBUG, "[playerOnline]", `Player ${P.name} is now online and settings saved!`);
			}).catch(e => console.log);
		}
		ws.send(JSON.stringify({ event: GI_EVENT.PLAYER_ONLINE, payload: Player }));
	}

    /**
     *
     *
     * @protected
     * @param {string} id
     * @param {string} name
     * @returns {RisingWorldPlayer}
     * @memberof RelayIO
     */
	protected getPlayer(id: string, name: string): RisingWorldPlayer {
		if (!RelayIO.Players.has(id)) {
			const anonymousPlayer: RisingWorldPlayer = Object.assign({}, EmptyPlayer, { _id: id, id64: id, name: name });
			RelayIO.Players.set(id, anonymousPlayer);
		}
		return RelayIO.Players.get(id);
	}

    /**
     *
     *
     * @protected
     * @memberof RelayIO
     */
	protected defaultChannels(): void {
		const defaultChannels: string[] = ['global', 'global-dev', 'global-de', 'global-en', 'global-ru', 'global-fr'];
		defaultChannels.forEach((chName) => {
			if (!RelayIO.Channels.has(chName)) {
				const ch: RisingWorldChannel = Object.assign({}, defaultChannel, { _id: chName, description: "default channel" });
				RelayIO.Channels.set(chName, ch);
				this.channelCol.save(ch).then(Channel => {
					console.log(LOGTAG.DEBUG, "[defaultChannels]", `Channel ${Channel._id} added and saved!`);
				}).catch(e => console.log);
			}
		});
	}

    /**
     *
     *
     * @protected
     * @memberof RelayIO
     */
	protected mongoAfterConnect(): void {
		this.playerCol = new PlayerCollection(this.MongoDatabase);
		this.channelCol = new ChannelCollection(this.MongoDatabase);

		super.mongoAfterConnect();

		this.loadDataFromDatabase();


		this.setupIOServer();
		this.setupDiscordBot();
	}

    /**
     *
     *
     * @protected
     * @memberof RelayIO
     */
	protected mongoOnSocketClose(): void {
		// this.changeStreams.forEach((CS) => {
		//     CS.destroy();
		// });
		super.mongoOnSocketClose();
	}
}