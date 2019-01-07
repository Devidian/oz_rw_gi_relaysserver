import { readFileSync } from "fs";
import { resolve } from "path";

export interface Config {
    log: {
        info: boolean,
        debug: boolean,
        warn: boolean
    },
    master: {
        title: string,
        ioport: number
    },
    cli: {
        commands: string[]
    },
    relayio: {
        port: number
    },
    discord: {
        enabled: boolean,
        token: string
    }
};
export var cfg: Config;

export enum LOGTAG {
    INFO = "[I]",
    DEBUG = "[D]",
    DEV = "[DEV]",
    ERROR = "[E]",
    WARN = "[W]"
}

let configPath: string, config: Buffer;
try {
    configPath = resolve(__dirname, "..", "config", "config.json");
    config = readFileSync(configPath);
    cfg = JSON.parse(config.toString());
} catch (error) {
    process.exit(666);
}
