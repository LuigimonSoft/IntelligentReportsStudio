import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {SourceSnapshot} from './source-snapshot.mjs';
import {acquireDevLock} from './dev-lock.mjs';

const contentTypes={'.html':'text/html; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript','.wasm':'application/wasm','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.pdf':'application/pdf'};

/** Build with Trunk, but reload only after a real source-content change. */
export async function serveFrontend(root,env,args,{serve=true,beforeBuild=async()=>{}}={}){
  const buildArgs=[];let port=Number(env.TRUNK_SERVE_PORT||1420),autoreload=true;
  for(let i=0;i<args.length;i++){
    const arg=args[i];
    if(arg==='--port'||arg==='-p'){port=Number(args[++i]);continue;}
    if(arg==='--poll')continue;
    if(arg==='--poll-interval'){i++;continue;}
    if(arg==='--no-autoreload'){autoreload=false;continue;}
    buildArgs.push(arg);
  }
  const distIndex=buildArgs.findIndex(arg=>arg==='--dist'||arg==='-d');
  const dist=path.resolve(root,distIndex<0?'target/csr':buildArgs[distIndex+1]);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid development server port.');
  const release=await acquireDevLock(env.CARGO_TARGET_DIR || path.join(root,'target'));
  let child,stopped=false,timer,server,checking=false,version=0;
  const clients=new Set();
  const build=async()=>{
    await beforeBuild();
    return new Promise((resolve,reject)=>{
    console.log('Report Studio: starting build');
    child=spawn('trunk',['build',...buildArgs],{cwd:root,env,stdio:'inherit'});
    child.once('error',reject);
    child.once('exit',(code,signal)=>{
      child=undefined;
      if(code===0){console.log('Report Studio: build complete');resolve();}
      else reject(new Error(`Frontend build failed: ${code??signal}`));
    });
    });
  };
  const stop=()=>{
    stopped=true;clearInterval(timer);child?.kill('SIGTERM');
    void release();
    for(const response of clients)response.end();
    server?.close();
  };
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,stop);
  const sources=new SourceSnapshot(root);
  let builtFingerprint;
  try{await build();}catch(error){await release();throw error;}
  if(stopped)return;
  console.log('Report Studio watcher: compare source contents; ignore metadata changes.');
  if(serve){
  server=createServer(async(request,response)=>{
    try{
      if(!['GET','HEAD'].includes(request.method)){response.writeHead(405).end();return;}
      const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
      if(pathname==='/__reportstudio_events'&&request.method==='GET'){
        response.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
        response.write(`event: ready\ndata: ${version}\n\n`);clients.add(response);
        request.on('close',()=>clients.delete(response));return;
      }
      const filename=path.resolve(dist,`.${pathname==='/'?'/index.html':pathname}`);
      if(!filename.startsWith(dist+path.sep)){response.writeHead(403).end();return;}
      let bytes=await readFile(filename);
      if(pathname==='/'||pathname==='/index.html'){
        if(autoreload){
          const script=`<script>(()=>{const version=${version};const updates=new EventSource('/__reportstudio_events');updates.addEventListener('reload',()=>location.reload());updates.addEventListener('ready',event=>{if(Number(event.data)!==version)location.reload();});})();</script>`;
          bytes=Buffer.from(bytes.toString().replace('</body>',script+'</body>'));
        }
      }
      response.writeHead(200,{'Content-Type':contentTypes[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});
      response.end(request.method==='HEAD'?undefined:bytes);
    }catch{response.writeHead(404).end();}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  console.log(`Report Studio CSR development server: http://127.0.0.1:${port}`);
  }
  console.log('Report Studio: preparing content watcher after server startup');
  try{builtFingerprint=await sources.fingerprint();}catch(error){stop();throw error;}
  if(stopped)return;
  let attemptedFingerprint=builtFingerprint;
  // The HTTP server starts after the first build; Tauri never opens stale assets.
  timer=setInterval(async()=>{
    if(stopped||checking)return;
    checking=true;
    try{
      const current=await sources.fingerprint();
      if(stopped)return;
      if(current!==attemptedFingerprint){
        attemptedFingerprint=current;
        await build();
        builtFingerprint=current;version++;
        for(const response of clients)response.write(`event: reload\ndata: ${version}\n\n`);
      }
    }catch(error){if(!stopped)console.error(error.message);}
    finally{checking=false;}
  },1000);
}
