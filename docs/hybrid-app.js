import * as THREE from './vendor/three/three.module.min.js';
import {createGalaxyBackdrop} from './galaxy-backdrop.js?v=20261028-hybrid2';
import {buildAtlasModel} from './hybrid-atlas-model.js?v=20261028-hybrid2';
import {buildFanModel} from './hybrid-fan-model.js?v=20261028-hybrid2';
import {renderGalaxyAtlas} from './galaxy-atlas.js?v=20261028-hybrid2';
import {renderGalaxyFan} from './galaxy-fan.js?v=20261028-hybrid2';
import {createHybridGalaxyState,reduceHybridGalaxyState,resolveSearchFocus} from './hybrid-galaxy-state.js?v=20261028-hybrid2';

export async function startHybridApp(){
  globalThis.__GALAXY_THREE_HOST__=true;
  await import('./app-legacy.js?v=20261028-hybrid2');
  const legacy=globalThis.__GALAXY_LEGACY__;
  if(!legacy?.graph)throw new Error('无法加载知识阅读器');
  const graph=legacy.graph,byId=new Map(graph.nodes.map(node=>[node.id,node]));
  const $=selector=>document.querySelector(selector);
  const stage=$('#hybrid-stage'),canvas=$('#galaxy-backdrop'),list=$('#fan-rows'),detail=$('#detail');
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches||matchMedia('(pointer:coarse)').matches||innerWidth<=720;
  let state=createHybridGalaxyState(),lastOpener=null,atlas,fan,backdrop,renderer,observer,frame;
  if(reduceMotion)state=reduceHybridGalaxyState(state,{type:'SET_MOTION',enabled:false});
  stage.hidden=false;
  try{
    renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,1,1,3000);camera.position.z=850;
    backdrop=createGalaxyBackdrop({THREE,scene,reducedMotion:reduceMotion,seed:42});
    const resize=()=>{renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);camera.updateProjectionMatrix();renderer.render(scene,camera)};
    observer=new ResizeObserver(resize);observer.observe(canvas);resize();
    const tick=time=>{if(state.motionEnabled&&!document.hidden){backdrop.setPhase(time/1000);renderer.render(scene,camera)}frame=requestAnimationFrame(tick)};
    if(!reduceMotion)frame=requestAnimationFrame(tick);
  }catch(error){console.warn('使用静态银河背景',error)}
  const atlasModel=()=>buildAtlasModel(graph,{activeDimensionId:state.activeDimensionId,width:innerWidth,height:innerHeight});
  const fanModel=()=>buildFanModel(graph,{dimensionId:state.activeDimensionId,focusedNodeId:state.focusedNodeId,expandedGroupIds:state.expandedGroupIds,maxCurves:24,relationMode:state.relationMode,pathClasses:state.pathClasses,platforms:state.platforms});
  function showTip(id){const tip=$('#star-tip');tip.hidden=!id;if(id)tip.textContent=byId.get(id)?.title||''}
  function dispatch(action,{scroll=true}={}){
    state=reduceHybridGalaxyState(state,action);
    atlas.update(atlasModel());atlas.setSearchMatches(state.searchMatches);
    fan.update(fanModel());$('#fan-name').textContent=byId.get(state.focusedNodeId)?.title||byId.get(state.activeDimensionId)?.title||'座舱架构';
    $('#hybrid-breadcrumb').textContent=byId.get(state.focusedNodeId)?.title||byId.get(state.activeDimensionId)?.title||'知识星图';
    if(scroll)list.scrollTop=state.fanScrollTop;
  }
  function selectDimension(id){if(byId.get(id)?.kind==='architecture_dimension'){if(!detail.hidden)legacy.clearSelection();dispatch({type:'SELECT_DIMENSION',id})}}
  function drill(id){if(byId.get(id)?.primaryParentId){if(!detail.hidden)legacy.clearSelection();dispatch({type:'DRILL_NODE',id})}}
  function openReader(id,opener){lastOpener=opener;state=reduceHybridGalaxyState(state,{type:'SET_FAN_SCROLL',top:list.scrollTop});state=reduceHybridGalaxyState(state,{type:'OPEN_READER',id});legacy.showNode(id);detail.hidden=false}
  atlas=renderGalaxyAtlas({svg:$('#atlas-svg'),cardLayer:$('#atlas-cards'),model:atlasModel(),onHover:showTip,onSelect:(dimensionId,nodeId)=>{selectDimension(dimensionId);if(nodeId!==dimensionId)drill(nodeId)}});
  fan=renderGalaxyFan({svg:$('#fan-curves'),list,groupsContainer:$('#hybrid-groups'),model:fanModel(),onDrill:drill,onOpenReader:openReader,onToggleGroup:id=>dispatch({type:'TOGGLE_GROUP',id})});
  $('#fan-name').textContent=byId.get(state.activeDimensionId)?.title||'座舱架构';
  $('#hybrid-back').addEventListener('click',()=>{
    if(!detail.hidden){legacy.clearSelection();return}
    const parent=byId.get(state.focusedNodeId)?.primaryParentId;
    if(parent&&parent!==state.activeDimensionId)dispatch({type:'DRILL_NODE',id:parent});else selectDimension(state.activeDimensionId);
  });
  window.addEventListener('galaxy:selection',event=>{
    const id=event.detail.id;
    if(id){state=reduceHybridGalaxyState(state,{type:'OPEN_READER',id})}
    else{state=reduceHybridGalaxyState(state,{type:'CLOSE_READER'});list.scrollTop=state.fanScrollTop;requestAnimationFrame(()=>{fan.setViewport();lastOpener?.focus()})}
  });
  window.addEventListener('galaxy:search',event=>{
    const matches=event.detail.matchingIds||[];
    state={...state,searchMatches:matches,motionEnabled:matches.length?false:state.motionEnabled};atlas.setSearchMatches(matches);
  });
  window.addEventListener('galaxy:search-focus',event=>{
    const focus=resolveSearchFocus(graph.nodes,event.detail.id);
    if(!focus){legacy.showNode(event.detail.id);return}
    if(!detail.hidden)legacy.clearSelection();
    dispatch({type:'SET_SEARCH',dimensionId:focus.dimensionId,nodeId:focus.focusedNodeId,matches:[focus.nodeId]});
    controls.classList.remove('hybrid-open');toggle.setAttribute('aria-expanded','false');
  });
  const toggle=$('#tools-toggle'),controls=document.querySelector('.controls');
  document.querySelector('#relation-mode').addEventListener('click',event=>{const button=event.target.closest('[data-relation-mode]');if(!button)return;for(const item of document.querySelectorAll('[data-relation-mode]'))item.setAttribute('aria-pressed',String(item===button));dispatch({type:'SET_FILTERS',relationMode:button.dataset.relationMode})});
  for(const button of document.querySelectorAll('.platform-chip,.path-chip'))button.addEventListener('click',()=>queueMicrotask(()=>dispatch({type:'SET_FILTERS',platforms:legacy.viewState.platforms,pathClasses:legacy.viewState.pathClasses},{scroll:false})));
  toggle.addEventListener('click',()=>{const open=controls.classList.toggle('hybrid-open');toggle.setAttribute('aria-expanded',String(open));if(open)$('#search').focus()});
  list.addEventListener('scroll',()=>{state=reduceHybridGalaxyState(state,{type:'SET_FAN_SCROLL',top:list.scrollTop})},{passive:true});
  window.addEventListener('resize',()=>dispatch({type:'SET_MOTION',enabled:state.motionEnabled},{scroll:false}));
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();if(frame)cancelAnimationFrame(frame);stage.classList.add('static-background')});
  return{get state(){return state},dispose(){if(frame)cancelAnimationFrame(frame);observer?.disconnect();backdrop?.dispose();renderer?.dispose();atlas.dispose();fan.dispose()}};
}
if(typeof window!=='undefined'&&typeof document!=='undefined')await startHybridApp();
