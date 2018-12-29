'use strict';
import { cfg, LOGTAG } from './config';
import { Master } from './Master';


!cfg.log.info ? null : console.log(LOGTAG.INFO, '[main]', 'starting master');
// Set process title
process.title = cfg.master.title;

let M = new Master();