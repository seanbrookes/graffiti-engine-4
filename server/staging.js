/*
  staging.js is a file designed to start a 'proxy' web server in a folder called
  'local-web-cloud'

  This setup is designed to simulate the target host server and allow preview of what the generated web site 
  will look like before commiting to a 'publish' event
*/
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- ESM path setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// --- End ESM path setup ---

const PORT = 8888;

// '..' moves up from /server/ to the project root
const DEPLOY_ROOT = path.join(__dirname, '../local-web-cloud'); 

// --- Auto-create folder if missing ---
if (!fs.existsSync(DEPLOY_ROOT)) {
  fs.mkdirSync(DEPLOY_ROOT, { recursive: true });
  console.log(`✨ Created missing folder: ${DEPLOY_ROOT}`);
} else {
  console.log(`📂 Target folder exists: ${DEPLOY_ROOT}`);
}
// -------------------------------------

const server = http.createServer((req, res) => {
  // Basic security: prevent navigating out of the folder with '..'
  const safeSuffix = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(DEPLOY_ROOT, safeSuffix === '/' ? 'index.html' : safeSuffix);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      // If the file isn't there, return 404
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${req.url}`);
    } else {
      let contentType = 'text/html';
      if (filePath.endsWith('.css')) contentType = 'text/css';
      if (filePath.endsWith('.js')) contentType = 'application/javascript';
      if (filePath.endsWith('.json')) contentType = 'application/json';
      if (filePath.endsWith('.png')) contentType = 'image/png';
      if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf8');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Staging deployment server running at http://localhost:${PORT}`);
});