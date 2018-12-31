#!/bin/bash

LOGDIR="/var/logs";
ROOTDIR="$(dirname "$0")";
NAME="oz-gi-relay-server";
cd $ROOTDIR;

# make sure nodejs user exists
adduser --shell /bin/bash --disabled-password nodejs

# setup systemd
cp -R "$ROOTDIR/app.service" "/usr/lib/systemd/system/$NAME.service";
cp -R "$ROOTDIR/app.conf" "/etc/rsyslog.d/$NAME.conf";
systemctl restart rsyslog.service;

systemctl enable $NAME.service
systemctl start $NAME.service