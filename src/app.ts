'use strict';
import 'module-alias/register';
import { Master } from './app/Master';
import { Logger, Loglevel } from './util';


Logger(Loglevel.INFO,'app',`starting ${process.env.APP_TITLE}`);
// Set process title
process.title = process.env.APP_TITLE;

let M = new Master();