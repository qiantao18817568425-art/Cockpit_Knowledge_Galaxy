export const RELEASE='20261114-webgl4';

export function detectWebGL(canvas){
  if(!canvas?.getContext)return false;
  try{return Boolean(canvas.getContext('webgl2')||canvas.getContext('webgl'))}catch{return false}
}

export function selectRenderer({query='',webglAvailable=false,desktop=true}={}){
  const requested=new URLSearchParams(query.startsWith('?')?query.slice(1):query).get('renderer');
  if(requested==='canvas')return 'canvas';
  return desktop&&webglAvailable?'three':'canvas';
}

export async function startRenderer({mode,importModule}){
  const entry=mode==='three'?'app-three':'app';
  await importModule(entry);
  if(entry==='app')globalThis.__GALAXY_BRIDGE__?.startCanvasRenderer?.();
  return mode;
}

function importEntry(entry){
  if(entry==='app-three')return import('./app-three.js?v=20261114-webgl4');
  return import('./app.js?v=20261114-webgl4');
}

function setRendererStatus(message,state='ready'){
  const status=document.querySelector('#renderer-status');
  if(status){status.textContent=message;status.dataset.state=state}
}

export async function bootPage({query=window.location.search,createCanvas=()=>document.createElement('canvas'),importModule=importEntry}={}){
  const webglAvailable=detectWebGL(createCanvas());
  const selected=selectRenderer({query,webglAvailable,desktop:window.innerWidth>900});
  document.documentElement.dataset.renderer=selected;
  try{
    await startRenderer({mode:selected,importModule});
    setRendererStatus(selected==='three'?'三维星图已启用':'兼容画布模式 · 3D 效果需要 WebGL',selected==='three'?'ready':'canvas');
    return selected;
  }catch(error){
    if(selected==='canvas')throw error;
    console.error('WebGL scene failed; starting Canvas fallback',error);
    globalThis.__GALAXY_THREE_HOST__=false;
    document.documentElement.dataset.renderer='canvas';
    setRendererStatus('三维场景未就绪，已切换兼容模式','fallback');
    await startRenderer({mode:'canvas',importModule});
    return 'canvas';
  }
}

if(typeof window!=='undefined'&&typeof document!=='undefined'){
  bootPage().catch(error=>{
    console.error('Cockpit galaxy failed to start',error);
    setRendererStatus('场景启动失败','error');
  });
}

