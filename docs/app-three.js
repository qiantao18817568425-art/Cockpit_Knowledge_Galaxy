import * as THREE from './vendor/three/three.module.min.js';
import {createGalaxyState,reduceGalaxyState,selectSceneMode} from './galaxy-state.js?v=20261028-three1';
import {buildDrillLayout,selectVisibleCards} from './constellation-layout.js?v=20261028-three1';
import {createGalaxyScene} from './galaxy-3d.js?v=20261028-three1';

const RELEASE='20261028-three1';

function nodeLevel(node){
  if(Number.isFinite(node?.hierarchyLevel))return node.hierarchyLevel;
  if(node?.kind==='root')return 0;
  if(node?.kind==='architecture_dimension')return 1;
  if(node?.kind==='architecture_chain')return 2;
  return 3;
}

function setPressed(container,value){
  for(const button of container.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.relationMode===value));
}

export async function startThreeApp(){
  globalThis.__GALAXY_THREE_HOST__=true;
  await import(`./app-legacy.js?v=${RELEASE}`);
  const legacy=globalThis.__GALAXY_LEGACY__;
  if(!legacy?.graph)throw new Error('Knowledge reader bridge failed to initialize');
  const graph=legacy.graph;
  const byId=new Map(graph.nodes.map(node=>[node.id,node]));
  const canvas=document.querySelector('#galaxy-three');
  const relationMode=document.querySelector('#relation-mode');
  const cardDeck=document.querySelector('#constellation-cards');
  const constellationIndex=document.querySelector('#constellation-index');
  const fanList=document.querySelector('#fan-list');
  const fanGroups=document.querySelector('#fan-groups');
  const hoverCard=document.querySelector('#hover-card');
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches||matchMedia('(pointer:coarse)').matches||innerWidth<=720;
  let state=createGalaxyState({reducedMotion});
  let scene;
  let frontIds=[];
  let threeCruising=!reducedMotion;

  function sceneState(){return{...state,mode:selectSceneMode(state)}}

  function dispatch(action){
    state=reduceGalaxyState(state,action);
    sync();
    return state;
  }

  function showNode(id){
    if(byId.has(id))legacy.showNode(id);
  }

  function renderCards(){
    const dimensions=graph.nodes.filter(node=>node.kind==='architecture_dimension');
    const visibleFront=frontIds.length?frontIds:dimensions.slice(0,innerWidth<=720?3:7).map(node=>node.id);
    const model=selectVisibleCards(graph,{selectedId:state.selectedId,hoveredId:state.hoveredId,frontIds:visibleFront},{mobile:innerWidth<=720});
    cardDeck.replaceChildren();
    for(const card of model.cards){
      const button=document.createElement('button');button.type='button';button.className='constellation-card';button.dataset.nodeId=card.id;
      const count=document.createElement('span');count.textContent=String(card.count).padStart(2,'0');
      const title=document.createElement('strong');title.textContent=card.title;
      const meta=document.createElement('small');meta.textContent='座舱架构星座';
      button.append(count,title,meta);button.addEventListener('click',()=>showNode(card.id));cardDeck.append(button);
    }
    constellationIndex.replaceChildren();
  }

  function makeFanButton(item){
    const li=document.createElement('li');
    const button=document.createElement('button');button.type='button';button.tabIndex=0;button.dataset.nodeId=item.id;
    const title=document.createElement('strong');title.textContent=item.title;
    const meta=document.createElement('small');meta.textContent=`L${nodeLevel(item)+1} · ${item.description||'知识节点'}`;
    button.append(title,meta);
    const activate=()=>showNode(item.id);
    button.addEventListener('click',activate);
    button.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate()}});
    li.append(button);return li;
  }

  function renderFan(){
    fanList.replaceChildren();fanGroups.replaceChildren();
    const selected=byId.get(state.selectedId);
    document.querySelector('.fan-panel').classList.toggle('is-active',Boolean(selected));
    if(!selected){fanList.classList.remove('is-scrollable');document.querySelector('#fan-title').textContent='智能座舱';document.querySelector('#fan-count').textContent='';return}
    const layout=buildDrillLayout(graph,selected.id,{state:sceneState(),maxListItems:24});
    fanList.classList.toggle('is-scrollable',layout.requiresScroll);
    for(const item of layout.listItems)fanList.append(makeFanButton(item));
    for(const group of layout.collapsedGroups){
      const expanded=group.expanded;
      const button=document.createElement('button');button.type='button';button.className='fan-group';
      button.textContent=`${expanded?'收起':'展开'} ${group.title} · ${group.nodeIds.length}`;
      button.addEventListener('click',()=>dispatch({type:expanded?'COLLAPSE_GROUP':'EXPAND_GROUP',groupId:group.id}));
      fanGroups.append(button);
    }
    document.querySelector('#fan-title').textContent=selected.title;
    document.querySelector('#fan-count').textContent=`${layout.listItems.length} 个下级节点${layout.requiresScroll?' · 可滚动':''}`;
  }

  function renderHover(id){
    hoverCard.classList.toggle('is-visible',Boolean(id));hoverCard.setAttribute('aria-hidden',String(!id));
    if(!id)return;
    const node=byId.get(id);if(!node)return;
    document.querySelector('#hover-kind').textContent=`L${nodeLevel(node)+1} · ${node.kind||'知识节点'}`;
    document.querySelector('#hover-title').textContent=node.title;
    document.querySelector('#hover-meta').textContent=node.description||'点击进入该知识链路';
  }

  function sync(){
    scene?.setState(sceneState());
    if(state.selectedId)scene?.focusNode(state.selectedId,{});
    setPressed(relationMode,state.relationMode);
    document.querySelector('#galaxy-root-label').hidden=Boolean(state.selectedId);
    renderCards();renderFan();renderHover(state.hoveredId);
  }

  scene=createGalaxyScene({
    THREE,canvas,graph,reducedMotion,
    onHover:id=>{state={...state,hoveredId:id};sync()},
    onSelect:id=>id?showNode(id):legacy.clearSelection(),
    onViewChange:({frontIds:ids})=>{frontIds=ids;renderCards()},
    onContextLost:({selectedId})=>{
      state=reduceGalaxyState(state,{type:'CONTEXT_LOST'});
      document.querySelector('#renderer-status').textContent=`3D 场景已暂停${selectedId?'，当前知识选择已保留':''}`;
      document.querySelector('#webgl-retry').hidden=false;document.querySelector('#canvas-fallback').hidden=false;
    }
  });

  window.addEventListener('galaxy:selection',event=>{
    const node=byId.get(event.detail.id);
    dispatch(node?{type:'SELECT_NODE',nodeId:node.id,hierarchyLevel:nodeLevel(node)}:{type:'CLEAR_SELECTION'});
  });
  relationMode.addEventListener('click',event=>{
    const mode=event.target.closest('[data-relation-mode]')?.dataset.relationMode;
    if(mode)dispatch({type:'SET_RELATION_MODE',mode});
  });
  for(const button of document.querySelectorAll('.path-chip'))button.addEventListener('click',()=>{
    queueMicrotask(()=>dispatch({type:'SET_FILTERS',platforms:legacy.viewState.platforms,pathClasses:legacy.viewState.pathClasses,evidenceVisible:legacy.viewState.evidenceVisible}));
  });
  for(const button of document.querySelectorAll('.platform-chip'))button.addEventListener('click',()=>{
    queueMicrotask(()=>dispatch({type:'SET_FILTERS',platforms:legacy.viewState.platforms,pathClasses:legacy.viewState.pathClasses,evidenceVisible:legacy.viewState.evidenceVisible}));
  });
  window.addEventListener('galaxy:search',event=>dispatch({type:'SET_SEARCH_MATCHES',matchingIds:event.detail.matchingIds||[],focusId:event.detail.focusId||state.selectedId,hierarchyLevel:event.detail.hierarchyLevel??state.selectedLevel}));
  canvas.addEventListener('pointerleave',()=>{state={...state,hoveredId:null};sync()});
  document.querySelector('#webgl-retry').addEventListener('click',()=>location.reload());
  document.querySelector('#canvas-fallback').addEventListener('click',()=>{location.href=`${location.pathname}?renderer=canvas`});
  document.querySelector('#motion-toggle').addEventListener('click',()=>{
    threeCruising=!threeCruising;scene.setCruising(threeCruising);
    document.querySelector('#motion-label').textContent=threeCruising?'银河缓慢旋转':'旋转已暂停';
  });
  for(const button of document.querySelectorAll('[data-zoom]'))button.addEventListener('click',()=>{
    const action=button.dataset.zoom;
    if(action==='reset')scene.resetView();else scene.zoomBy(action==='in'?1.2:1/1.2);
  });
  const observer=new ResizeObserver(entries=>{const rect=entries[0].contentRect;scene.resize({width:rect.width,height:rect.height,dpr:devicePixelRatio||1});renderCards()});
  observer.observe(canvas);
  sync();

  return{dispatch,showNode,showReference:legacy.showReference,downloadReaderSummary:legacy.downloadReaderSummary,dispose(){observer.disconnect();scene.dispose()},get state(){return state}};
}

if(typeof window!=='undefined'&&typeof document!=='undefined')await startThreeApp();
