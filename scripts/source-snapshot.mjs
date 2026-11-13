import {createHash} from 'node:crypto';
import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';

export const frontendInputs=['app/src','frontend/src','runtime','examples/awb/awb-full-form-template.json','examples/awb/awb-data-only-template.json','examples/awb/awb-sample-data.json','public','index.html','Cargo.toml','app/Cargo.toml','frontend/Cargo.toml','Trunk.toml'];

/** Directory/access-time notifications are hints, not edits. Compare file bytes. */
export class SourceSnapshot {
  constructor(root,inputs=frontendInputs){this.root=root;this.inputs=inputs;}
  async fingerprint(){
    const files=[];
    const visit=async filename=>{
      let info;
      try{info=await stat(filename);}catch(error){if(error.code==='ENOENT')return;throw error;}
      if(info.isDirectory()){
        for(const entry of await readdir(filename,{withFileTypes:true})){
          if(entry.name==='.DS_Store'||entry.name.startsWith('._')||entry.name==='node_modules'||entry.isSymbolicLink())continue;
          await visit(path.join(filename,entry.name));
        }
      }else if(info.isFile()){
        const relative=path.relative(this.root,filename).split(path.sep).join('/');
        // esbuild output is derived from runtime sources. Watching it would create a reload loop.
        if (/^public\/vendor\/(?:reportstudio-runtime\.js|runtime-manifest\.json|(?:chunk|sample|pdf|renderChart)-[A-Za-z0-9]+\.js)$/.test(relative)) return;
        files.push([filename,info]);
      }
    };
    for(const input of this.inputs)await visit(path.join(this.root,input));
    files.sort(([a],[b])=>a.localeCompare(b));
    const result=createHash('sha256');
    // Windows filesystems can preserve inode, size, mtime and ctime after a
    // rapid rewrite. Hash the bytes on every scan instead of trusting metadata.
    for(const [filename] of files){
      const hash=createHash('sha256').update(await readFile(filename)).digest('hex');
      result.update(path.relative(this.root,filename)).update('\0').update(hash).update('\0');
    }
    return result.digest('hex');
  }
}
