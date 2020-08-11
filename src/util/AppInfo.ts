import { resolve } from "path";
import { existsSync } from "fs";
import { cwd } from "process";

export class AppInfo {

    /**
     * return app version from package.json
     *
     * @static
     * @returns {Promise<string>}
     * @memberof AppInfo
     */
    public static async version(): Promise<string> {
        const packageFilePath = resolve(AppInfo.cwd(), "package.json");
        if (existsSync(packageFilePath)) {
            const packageInfo = await import(packageFilePath);

            return packageInfo.version;
        } else {
            return "1.0.0";
        }
    }

    /**
     * maybe we need to change the path if its not set correctly in a system
     * so we do not use process.cwd directly.
     *
     * @static
     * @returns {string}
     * @memberof AppInfo
     */
    public static cwd(): string {
        return cwd();
    }
}