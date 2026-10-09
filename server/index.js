import { resolve } from 'node:path';
import { createDatabase,seed } from './database.js';
import { createApp } from './app.js';
const db=createDatabase(resolve(process.env.DATABASE_PATH||'.data/lendinghub.sqlite'));seed(db);
const app=createApp(db,{uploadDir:resolve(process.env.UPLOAD_DIR||'.data/uploads'),demoMode:process.env.DEMO_MODE!=='false'});
const port=Number(process.env.PORT||3000);const server=app.listen(port,process.env.HOST||'0.0.0.0',()=>console.log(`Lending Hub demo listening on port ${port}`));
function close(){server.close(()=>{db.close();process.exit(0);});}
process.on('SIGTERM',close);process.on('SIGINT',close);
