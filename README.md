# About
This is the Websocket-Relay Server for the Rising World Plugin "Global Intercom" by devidian@omega-zirkel.de.

It is written in TypeScript and uses nodejs to run.

.. more coming soon


# .env Content

```env
APP_TITLE=Global Intercom Relay Server
APP_CLI_PORT=47010
APP_WSS_PORT=47015

DISCORD_ENABLED=true
DISCORD_TOKEN=

MONGODB_URI=
MONGODB_DB=risingworld
MONGODB_APPNAME=RW-GI

LOGLEVEL=0
LOGCOLOR=true
```

# using docker

```ps
docker build -t rwgi .

docker run -dp 47015:47015 --name RW-GLobalIntercom rwgi
```