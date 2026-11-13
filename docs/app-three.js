import * as THREE from './vendor/three/three.module.min.js';
import {createStarmapScene} from './starmap-webgl.js?v=20261114-webgl4';

const RELEASE='20261114-webgl4';

function fallbackUrl(){
  const url=new URL(window.location.href);
  url.searchParams.set('renderer','canvas');
  return url.href;
}

export async function startThreeApp(){
  globalThis.__GALAXY_THREE_HOST__=true;
  await import(`./app.js?v=${RELEASE}`);
  const bridge=globalThis.__GALAXY_BRIDGE__;
  if(!bridge?.graph||typeof bridge.showNode!=='function'||typeof bridge.clearSelection!=='function')throw new Error('Knowledge reader bridge failed to initialize');

  const graph=bridge.graph;
  const byId=new Map(graph.nodes.map(node=>[node.id,node]));
  const canvas=document.querySelector('#galaxy-three');
  const labelLayer=document.querySelector('#starmap-labels');
  const hoverCard=document.querySelector('#hover-card');
  const rendererStatus=document.querySelector('#renderer-status');
  const retry=document.querySelector('#webgl-retry');
  const fallback=document.querySelector('#canvas-fallback');
  const motionToggle=document.querySelector('#motion-toggle');
  const motionLabel=document.querySelector('#motion-label');
  if(!canvas||!labelLayer||!rendererStatus||!retry||!fallback)throw new Error('WebGL shell is incomplete');

  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const labels=new Map();
  let lastPointer={x:0,y:0};
  let hoveredId=null;
  let cruising=!reducedMotion;
  let scene;

  function renderLabels(items=[]){
    const nextIds=new Set();
    for(const item of items){
      const id=item.id;
      if(!byId.has(id))continue;
      nextIds.add(id);
      let button=labels.get(id);
      if(!button){
        button=document.createElement('button');
        button.type='button';
        button.className='starmap-label';
        button.dataset.nodeId=id;
        button.textContent=item.title;
        button.setAttribute('aria-label',`查看 ${item.title}`);
        button.addEventListener('click',()=>bridge.showNode(id));
        labelLayer.append(button);
        labels.set(id,button);
      }
      button.style.left=`${Math.round(item.x)}px`;
      button.style.top=`${Math.round(item.y)}px`;
      button.classList.toggle('is-active',Boolean(item.active));
      button.classList.toggle('is-hovered',Boolean(item.hovered));
      button.classList.toggle('is-featured',Boolean(item.featured));
    }
    for(const [id,button] of labels){
      if(nextIds.has(id))continue;
      button.remove();
      labels.delete(id);
    }
  }

  function renderHover(id){
    hoveredId=id;
    hoverCard?.classList.toggle('is-visible',Boolean(id));
    hoverCard?.setAttribute('aria-hidden',String(!id));
    if(!id)return;
    const node=byId.get(id);
    if(!node)return;
    const kind=node.kind==='architecture_dimension'?'架构星区':node.kind==='architecture_chain'?'知识链路':'知识节点';
    document.querySelector('#hover-kind').textContent=kind;
    document.querySelector('#hover-title').textContent=node.title;
    document.querySelector('#hover-meta').textContent=node.description||'点击聚焦这颗知识星点';
    const x=Math.min(canvas.clientWidth-hoverCard.offsetWidth-14,Math.max(14,lastPointer.x+22));
    const y=Math.min(canvas.clientHeight-hoverCard.offsetHeight-14,Math.max(14,lastPointer.y+18));
    hoverCard.style.left=`${x}px`;
    hoverCard.style.top=`${y}px`;
  }

  function showFallback(selectedId){
    rendererStatus.textContent=`三维场景已暂停${selectedId?' · 阅读器仍可使用':''}；切换将重新载入页面`;
    rendererStatus.dataset.state='fallback';
    retry.hidden=false;
    fallback.hidden=false;
    renderHover(null);
  }

  scene=createStarmapScene({
    THREE,canvas,graph,reducedMotion,
    onHover:renderHover,
    onSelect:id=>id?bridge.showNode(id):bridge.clearSelection(),
    onViewChange:({labels:items,visibleCount})=>{
      renderLabels(items);
      const count=document.querySelector('#starmap-visible-count');
      if(count)count.textContent=`${visibleCount} 个可探索节点`;
    },
    onContextLost:({selectedId})=>showFallback(selectedId)
  });

  const syncState=event=>scene.setState(event.detail||bridge.getSceneState());
  window.addEventListener('galaxy:state',syncState);
  scene.setState(bridge.getSceneState());

  const trackPointer=event=>{
    const bounds=canvas.getBoundingClientRect();
    lastPointer={x:event.clientX-bounds.left,y:event.clientY-bounds.top};
    if(hoveredId)renderHover(hoveredId);
  };
  canvas.addEventListener('pointermove',trackPointer);
  retry.addEventListener('click',()=>window.location.reload());
  fallback.addEventListener('click',()=>window.location.assign(fallbackUrl()));
  const syncMotion=enabled=>{
    document.documentElement.classList.toggle('galaxy-paused',!enabled);
    document.documentElement.classList.toggle('galaxy-motion-opt-in',reducedMotion&&enabled);
    motionLabel.textContent=enabled?'3D 自动巡航':reducedMotion&&!cruising?'系统减少动态':'巡航已暂停';
    motionToggle.textContent=enabled?'暂停':'开启';
    motionToggle.setAttribute('aria-pressed',String(enabled));
    motionToggle.setAttribute('aria-label',enabled?'暂停自动巡航':'开启自动巡航');
    motionToggle.title=enabled?'暂停自动巡航':'开启自动巡航';
  };
  const motionClick=()=>{cruising=scene.setCruising(!cruising);syncMotion(cruising)};
  syncMotion(cruising);
  motionToggle.addEventListener('click',motionClick);
  const zoomClick=event=>{
    const action=event.currentTarget.dataset.zoom;
    if(action==='reset')scene.resetView();
    else scene.zoomBy(action==='in'?1.2:1/1.2);
  };
  for(const button of document.querySelectorAll('[data-zoom]'))button.addEventListener('click',zoomClick);
  const resize=()=>{
    const bounds=canvas.getBoundingClientRect();
    scene.resize({width:bounds.width,height:bounds.height,dpr:devicePixelRatio||1});
  };
  const observer=new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  return{
    scene,
    dispose(){
      observer.disconnect();
      window.removeEventListener('galaxy:state',syncState);
      canvas.removeEventListener('pointermove',trackPointer);
      motionToggle.removeEventListener('click',motionClick);
      for(const button of document.querySelectorAll('[data-zoom]'))button.removeEventListener('click',zoomClick);
      for(const button of labels.values())button.remove();
      labels.clear();
      scene.dispose();
    }
  };
}

if(typeof window!=='undefined'&&typeof document!=='undefined')await startThreeApp();
