// CommonJS bootstrap for hosting panels that load startup files via require().
process.chdir(__dirname);
import('./server/index.js').catch(error => {console.error(error);process.exit(1);});
