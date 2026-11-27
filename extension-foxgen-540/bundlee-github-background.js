/* GitHub REST connector dedicated to the newly ported GitHub Mode.
   Does not intercept or alter existing v40.5 authentication, Lovable or Eklas messages. */
(() => {
  'use strict';
  const PREFIX='bundlee_git_127hub_github_';
  function safeRepo(value) {
    const repo=String(value || '').trim().replace(/^https?:\/\/github\.com\//i,'').replace(/\.git$/i,'');
    if (!/^[a-zA-Z0-9_.-]{1,39}\/[a-zA-Z0-9_.-]{1,100}$/.test(repo) || repo.includes('..')) throw new Error('Enter repository as owner/repo');
    return repo;
  }
  function branch(value) {
    const b=String(value || 'main').trim();
    if (!b || b.length>150 || /\.\.|[~^:?*\[\\]|\/$|^\//.test(b)) throw new Error('Invalid Git branch');
    return b;
  }
  const escapePath=(path)=>String(path).split('/').map(encodeURIComponent).join('/');
  function filePath(value) {
    const path=String(value||'').replace(/^\/+/, '');
    if (!path || path.length>500 || path.split('/').some(p=>!p||p==='.'||p==='..')) throw new Error('Invalid repository file path');
    return path;
  }
  async function api(path,token,{method='GET',body}={}) {
    if (!token || typeof token !== 'string') throw new Error('GitHub token is required');
    const res=await fetch('https://api.github.com'+path,{method,headers:{
      'Accept':'application/vnd.github+json','Authorization':'Bearer '+token,
      'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'
    }, ...(body === undefined ? {} : {body:JSON.stringify(body)})});
    const data=await res.json().catch(()=>({}));
    if (!res.ok) throw new Error('GitHub API '+res.status+': '+String(data.message || res.statusText || 'Request failed').slice(0,240));
    return data;
  }
  function encBase64(text) {
    const bytes=new TextEncoder().encode(String(text));
    let str=''; for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.slice(i,i+8192));
    return btoa(str);
  }
  function decBase64(base) {
    const raw=atob(String(base||'').replace(/\s+/g,''));
    return new TextDecoder().decode(Uint8Array.from(raw,c=>c.charCodeAt(0)));
  }
  async function autoConnect(m) {
    const token=String(m.token||'').trim();
    const who=await api('/user',token);
    let desired=String(m.preferredRepo||'').trim().replace(/^https?:\/\/github\.com\//i,'').replace(/\.git$/i,'');
    if (!desired) desired=(who.login+'/'+String(m.projectName||'bundlee-lovable-project').toLowerCase().replace(/[^a-z0-9._-]+/g,'-').slice(0,70));
    else if (!desired.includes('/')) desired=who.login+'/'+desired;
    const repo=safeRepo(desired);
    let row,created=false;
    try {row=await api('/repos/'+repo,token);}
    catch(e) {
      if (!/GitHub API 404:/.test(String(e.message))) throw e;
      if (repo.split('/')[0].toLowerCase()!==String(who.login).toLowerCase()) throw new Error('Cannot create a repository in a different owner account');
      row=await api('/user/repos',token,{method:'POST',body:{name:repo.split('/')[1],private:true,auto_init:true,description:'Lovable AI GitHub Mode project'}});
      created=true;
    }
    return {ok:true,repository:row.full_name||repo,branch:row.default_branch||'main',created};
  }
  async function tree(m) {
    const repo=safeRepo(m.repository),token=String(m.token||'');
    const data=await api('/repos/'+repo+'/git/trees/'+escapePath(branch(m.branch))+'?recursive=1',token);
    return {ok:true,files:(data.tree||[]).filter(f=>f.type==='blob').map(f=>f.path).slice(0,12000),truncated:!!data.truncated};
  }
  async function files(m) {
    const repo=safeRepo(m.repository),token=String(m.token||''),ref=branch(m.branch);
    const paths=(Array.isArray(m.paths)?m.paths:[]).slice(0,30);
    const max=Math.max(2000,Math.min(1000000,Number(m.maxTotalChars)||250000));
    const result=[];let budget=0;
    for(const pathRaw of paths){
      const path=filePath(pathRaw);
      try {
        const row=await api('/repos/'+repo+'/contents/'+escapePath(path)+'?ref='+encodeURIComponent(ref),token);
        if(row.type!=='file')continue;
        const content=row.encoding==='base64'?decBase64(row.content):'';
        budget+=content.length;
        if(budget>max)break;
        result.push({path,content,sha:row.sha});
      } catch(e){if(!/GitHub API 404:/.test(String(e.message)))throw e;}
    }
    return {ok:true,files:result};
  }
  async function commit(m){
    const repo=safeRepo(m.repository),token=String(m.token||''),ref=branch(m.branch);
    const changes=m.changes;
    if(!Array.isArray(changes)||!changes.length||changes.length>80)throw new Error('Expected 1–80 proposed file changes');
    const base='/repos/'+repo;
    const head=await api(base+'/git/ref/heads/'+escapePath(ref),token);
    const headSha=head.object?.sha;
    if(!headSha)throw new Error('Missing GitHub branch head');
    const old=await api(base+'/git/commits/'+headSha,token);
    const tree=[];
    for(const ch of changes) {
      const path=filePath(ch.path),deleteFile=String(ch.action||'').toLowerCase()==='delete';
      if(deleteFile){tree.push({path,mode:'100644',type:'blob',sha:null});continue;}
      if(typeof ch.content!=='string')throw new Error('Missing final content for '+path);
      if(ch.content.length>2_000_000)throw new Error('File too large for GitHub Mode: '+path);
      const blob=await api(base+'/git/blobs',token,{method:'POST',body:{content:encBase64(ch.content),encoding:'base64'}});
      tree.push({path,mode:'100644',type:'blob',sha:blob.sha});
    }
    const nextTree=await api(base+'/git/trees',token,{method:'POST',body:{base_tree:old.tree.sha,tree}});
    const nextCommit=await api(base+'/git/commits',token,{method:'POST',body:{message:String(m.message||'Update via Lovable AI').slice(0,500),tree:nextTree.sha,parents:[headSha]}});
    await api(base+'/git/refs/heads/'+escapePath(ref),token,{method:'PATCH',body:{sha:nextCommit.sha,force:false}});
    return {ok:true,sha:nextCommit.sha,branch:ref,repository:repo,filesChanged:tree.length};
  }
  chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
    if(!msg||typeof msg.action!=='string'||!msg.action.startsWith(PREFIX))return false;
    if(!sender || !sender.url || !/^https:\/\/(?:[^/]+\.)?lovable\.dev\//.test(sender.url)){
      respond({ok:false,error:'GitHub Mode only runs in Lovable tabs'});return false;
    }
    const kind=msg.action.slice(PREFIX.length);
    const handler={auto_connect:autoConnect,get_tree:tree,get_files:files,commit_direct:commit}[kind];
    if(!handler){respond({ok:false,error:'Unsupported GitHub action'});return false;}
    Promise.resolve().then(()=>handler(msg)).then(respond).catch(e=>respond({ok:false,error:String(e.message||e)}));
    return true;
  });
})();
