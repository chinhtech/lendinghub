import { defineConfig } from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dataDir=mkdtempSync(join(tmpdir(),'lending-browser-'));
export default defineConfig({testDir:'tests/browser',fullyParallel:false,workers:1,timeout:45000,use:{baseURL:'http://127.0.0.1:3100',headless:true,launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']},trace:'retain-on-failure'},webServer:{command:'npm start',env:{PORT:'3100',DATABASE_PATH:join(dataDir,'db.sqlite'),UPLOAD_DIR:join(dataDir,'uploads')},url:'http://127.0.0.1:3100/api/health',reuseExistingServer:false},reporter:'list'});
