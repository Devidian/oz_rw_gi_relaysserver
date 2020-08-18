import { LOGTAG, ConsoleColors } from "./enums";

export function Logger(level: number, source: string, ...messages: any[]): void {
    const currentLevel = Number(process.env.APP_LOGLEVEL) || 0;
    const useColor = [1, '1', true, 'true'].includes(process.env.APP_LOGCOLOR.toLowerCase());

    if (level < currentLevel) {
        return;
    }
    let color = ConsoleColors.FG_BLUE;
    let levelTag = LOGTAG.DEBUG;
    if (level >= 900) {
        levelTag = LOGTAG.ERROR;
        color = ConsoleColors.FG_RED;
    } else if (level >= 500) {
        levelTag = LOGTAG.WARN;
        color = ConsoleColors.FG_YELLOW
    } else if (level >= 100) {
        levelTag = LOGTAG.INFO;
        color = ConsoleColors.FG_WHITE;
    } else if (level < 11) {
        levelTag = LOGTAG.DEV;
        color = ConsoleColors.FG_MAGENTA;
    }
    if (useColor) {
        console.log(color + levelTag + ConsoleColors.RESET, `[${source}]`, ...messages);
    } else {
        console.log(levelTag, `[${source}]`, ...messages);
    }
}
