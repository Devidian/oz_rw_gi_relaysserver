export interface SteamProfile {
    provider: string;
    _json: {
        steamid: string,
        communityvisibilitystate: number,
        profilestate: number,
        personaname: string,
        commentpermission: number,
        profileurl: string,
        avatar: string,
        avatarmedium: string,
        avatarfull: string,
        avatarhash: string,
        lastlogoff: number,
        personastate: number,
        realname: string,
        primaryclanid: string,
        timecreated: number,
        personastateflags: 0,
        loccountrycode: string,
        locstatecode: string,
        loccityid: number,
    };
    id: string;
    displayName: string;
    photos: {
        value: string
    }[];
}