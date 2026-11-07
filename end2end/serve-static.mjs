// Serve the built CSR assets for integration tests, without a compiler or reload socket.
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(process.env.REPORTSTUDIO_ASSET_DIR || fileURLToPath(new URL('../target/csr',import.meta.url)));
const port=Number(process.env.REPORTSTUDIO_PORT || 1420);
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript','.wasm':'application/wasm','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.pdf':'application/pdf'};
await stat(path.join(root,'index.html'));
const server=createServer(async(request,response)=>{
 try {
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405).end();return;}
  const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  const filename=path.resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
  if(!filename.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  const bytes=await readFile(filename);
  response.writeHead(200,{'Content-Type':types[path.extname(filename)] || 'application/octet-stream','Cache-Control':'no-store'});
  response.end(request.method==='HEAD'?undefined:bytes);
 } catch {response.writeHead(404).end();}
});
server.listen(port,'127.0.0.1',()=>console.log(`CSR static assets: http://127.0.0.1:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close());
