import {buildDrillLayout,buildOverviewLayout} from './constellation-layout.js?v=20261028-three1';
import {createActiveFan,createEdgeBatches,createNodeCloud,nodeVisual,relationClass} from './constellation-materials.js?v=20261028-three1';
import {VISUAL_CONFIG} from './visual-config.js?v=20261028-three1';

function defaultScheduler(){
  return{
    request:callback=>requestAnimationFrame(callback),
    cancel:id=>cancelAnimationFrame(id)
  };
}

function normalizeState(state={}){
  return{
    mode:state.mode||'home',
    selectedId:state.selectedId||null,
    hoveredId:state.hoveredId||null,
    relationMode:state.relationMode||'hierarchy',
    pathFilter:state.pathFilter||'all',
    pathClasses:[...(state.pathClasses||[])],
    platforms:[...(state.platforms||[])],
    matchingIds:[...(state.matchingIds||[])],
    expandedGroupIds:state.expandedGroupIds instanceof Set?state.expandedGroupIds:new Set(state.expandedGroupIds||[])
  };
}

function edgeEndpoints(edge){
  return{...edge,from:edge.from||edge.source,to:edge.to||edge.target};
}

function disposeTree(object){
  if(!object)return;
  object.traverse?.(item=>{
    item.geometry?.dispose?.();
    if(Array.isArray(item.material))item.material.forEach(material=>material?.dispose?.());
    else item.material?.dispose?.();
  });
}

export function createGalaxyScene({
  THREE,canvas,graph,onHover=()=>{},onSelect=()=>{},onContextLost=()=>{},
  onViewChange=()=>{},reducedMotion=false,rendererFactory,frameScheduler
}){
  if(!THREE||!canvas)throw new Error('Three.js and a canvas are required');
  const scheduler=frameScheduler||defaultScheduler();
  const renderer=rendererFactory?rendererFactory({THREE,canvas}):new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
  const scene=new THREE.Scene();
  if(THREE.Color)scene.background=new THREE.Color(VISUAL_CONFIG.background);
  const camera=new THREE.PerspectiveCamera(42,1,1,3000);
  camera.position.set?.(0,0,1050);
  camera.lookAt?.(0,0,0);
  const world=new THREE.Group();
  const content=new THREE.Group();
  const fanGroup=new THREE.Group();
  world.add(content,fanGroup);
  scene.add(world);
  const raycaster=new THREE.Raycaster();
  raycaster.params.Points=raycaster.params.Points||{};
  raycaster.params.Points.threshold=12;
  const pointer=new THREE.Vector2();
  let state=normalizeState();
  let positions=new Map();
  let points=null;
  let frameId=null;
  let disposed=false;
  let contextLost=false;
  let pixelRatio=1;
  let userCruising=!reducedMotion;
  let cruising=userCruising;
  let fanCameraFacing=false;
  let lastHover=null;
  let drag=null;
  let suppressClick=false;
  let cameraDistance=1050;
  let lastFrontSignature='';

  function notifyFront(){
    if(state.mode!=='home')return;
    const angle=world.rotation.y||0,cos=Math.cos(angle),sin=Math.sin(angle);
    const ids=(graph.nodes||[]).filter(node=>node.kind==='architecture_dimension'&&positions.has(node.id)).map(node=>{
      const point=positions.get(node.id);return{id:node.id,z:-point.x*sin+point.z*cos};
    }).sort((a,b)=>b.z-a.z).slice(0,7).map(item=>item.id);
    const signature=ids.join('|');
    if(signature!==lastFrontSignature){lastFrontSignature=signature;onViewChange({frontIds:ids})}
  }

  function clearGroup(group){
    for(const child of [...(group.children||[])]){
      group.remove(child);
      disposeTree(child);
    }
  }

  function activePathIds(){
    const ids=new Set();
    let current=(graph.nodes||[]).find(node=>node.id===state.selectedId);
    while(current){
      ids.add(current.id);
      current=(graph.nodes||[]).find(node=>node.id===current.primaryParentId);
    }
    return ids;
  }

  function platformVisible(node){
    if(!state.platforms.length||node.id===state.selectedId||node.kind==='root'||node.kind==='architecture_dimension')return true;
    const values=node.platforms||node.scope?.platforms||[];
    return !values.length||values.some(value=>state.platforms.includes(value));
  }

  function renderContent(){
    clearGroup(content);
    clearGroup(fanGroup);
    const activeIds=activePathIds();
    let nodes=[];
    let edges=[];
    let curves=[];
    if(state.mode==='home'||!state.selectedId){
      world.position?.set?.(0,0,0);
      positions=buildOverviewLayout(graph);
      nodes=(graph.nodes||[]).filter(node=>positions.has(node.id)&&platformVisible(node));
      const nodeIds=new Set(nodes.map(node=>node.id));
      edges=(graph.edges||[]).map(edgeEndpoints).filter(edge=>{
        if(!nodeIds.has(edge.from)||!nodeIds.has(edge.to))return false;
        const kind=relationClass(edge);
        if(state.relationMode==='technical')return !kind.startsWith('hierarchy')&&(!state.pathClasses?.length||state.pathClasses.includes(kind));
        return kind.startsWith('hierarchy');
      });
      fanCameraFacing=false;
      cruising=userCruising&&!reducedMotion;
    }else{
      world.rotation.x=0;world.rotation.y=0;world.position?.set?.(0,0,0);
      const layout=buildDrillLayout(graph,state.selectedId,{state});
      positions=layout.positions;
      nodes=(graph.nodes||[]).filter(node=>positions.has(node.id)&&platformVisible(node));
      const nodeIds=new Set(nodes.map(node=>node.id));
      edges=(graph.edges||[]).map(edgeEndpoints).filter(edge=>{
        if(!nodeIds.has(edge.from)||!nodeIds.has(edge.to))return false;
        const kind=relationClass(edge);
        if(state.relationMode==='technical')return !kind.startsWith('hierarchy')&&(!state.pathClasses?.length||state.pathClasses.includes(kind));
        return kind.startsWith('hierarchy');
      });
      curves=layout.curves;
      fanCameraFacing=true;
      cruising=false;
    }
    const visuals=new Map(nodes.map(node=>[node.id,nodeVisual(node,{
      selected:node.id===state.selectedId,
      hovered:node.id===state.hoveredId,
      onActivePath:activeIds.has(node.id)||state.matchingIds.includes(node.id),
      mode:state.mode
    })]));
    points=createNodeCloud(THREE,nodes,positions,visuals);
    content.add(points);
    for(const batch of createEdgeBatches(THREE,edges,positions).values())content.add(batch);
    if(curves.length)fanGroup.add(createActiveFan(THREE,curves));
    requestFrame();
  }

  function render(){
    frameId=null;
    if(disposed||contextLost)return;
    if(cruising)world.rotation.y=(world.rotation.y||0)+.00055;
    if(fanCameraFacing)fanGroup.quaternion?.copy?.(camera.quaternion);
    renderer.render(scene,camera);
    notifyFront();
    if(cruising)requestFrame();
  }

  function requestFrame(){
    if(frameId!==null||disposed||contextLost)return;
    frameId=scheduler.request(render);
  }

  function cancelFrame(){
    if(frameId===null)return;
    scheduler.cancel(frameId);
    frameId=null;
  }

  function pick({x,y}){
    const bounds=canvas.getBoundingClientRect();
    pointer.set(((x-bounds.left)/bounds.width)*2-1,-((y-bounds.top)/bounds.height)*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hit=points?raycaster.intersectObject(points,false)?.[0]:null;
    return hit&&points.userData.nodeIds?.[hit.index]||null;
  }

  function handleMove(event){
    if(drag){
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(Math.abs(dx)+Math.abs(dy)>4){drag.moved=true;suppressClick=true}
      world.rotation.y=drag.yaw+dx*.0045;
      world.rotation.x=Math.max(-.65,Math.min(.65,drag.pitch+dy*.0032));
      notifyFront();requestFrame();return;
    }
    const id=pick({x:event.clientX,y:event.clientY});
    if(id===lastHover)return;
    lastHover=id;
    onHover(id);
  }

  function handleClick(event){
    if(suppressClick){suppressClick=false;return}
    const id=pick({x:event.clientX,y:event.clientY});
    onSelect(id||null);
  }

  function handleDown(event){if(state.mode!=='home')return;drag={x:event.clientX,y:event.clientY,yaw:world.rotation.y||0,pitch:world.rotation.x||0,moved:false};canvas.setPointerCapture?.(event.pointerId)}
  function handleUp(){drag=null;requestFrame()}
  function zoomBy(factor){cameraDistance=Math.max(620,Math.min(1650,cameraDistance/factor));camera.position.set?.(0,0,cameraDistance);requestFrame();return cameraDistance}
  function handleWheel(event){event.preventDefault?.();zoomBy(event.deltaY<0?1.1:1/1.1)}

  function handleContextLost(event){
    event.preventDefault?.();
    if(contextLost)return;
    contextLost=true;
    cancelFrame();
    onContextLost({selectedId:state.selectedId});
  }

  canvas.addEventListener('pointermove',handleMove);
  canvas.addEventListener('pointerdown',handleDown);
  canvas.addEventListener('pointerup',handleUp);
  canvas.addEventListener('pointercancel',handleUp);
  canvas.addEventListener('wheel',handleWheel,{passive:false});
  canvas.addEventListener('click',handleClick);
  canvas.addEventListener('webglcontextlost',handleContextLost);

  function setState(nextState){
    state=normalizeState(nextState);
    renderContent();
  }

  function focusNode(id,{durationMs=reducedMotion?0:520}={}){
    if(!positions.has(id))return false;
    if(state.mode!=='home'){requestFrame();return{durationMs}}
    const point=positions.get(id);
    world.position?.set?.(-point.x,-point.y,-point.z);
    camera.lookAt?.(0,0,0);
    requestFrame();
    return{durationMs};
  }

  function setCruising(value){userCruising=Boolean(value)&&!reducedMotion;cruising=userCruising&&state.mode==='home';requestFrame();return cruising}
  function resetView(){world.rotation.x=0;world.rotation.y=0;world.position?.set?.(0,0,0);cameraDistance=1050;camera.position.set?.(0,0,cameraDistance);requestFrame()}

  function resize({width,height,dpr=1}){
    pixelRatio=Math.min(Math.max(1,dpr||1),1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width,height,false);
    camera.aspect=width/Math.max(1,height);
    camera.updateProjectionMatrix?.();
    raycaster.params.Points.threshold=Math.max(6,14/(pixelRatio||1));
    requestFrame();
  }

  function restoreContext(){
    if(!contextLost)return false;
    contextLost=false;
    renderContent();
    return true;
  }

  function dispose(){
    if(disposed)return;
    disposed=true;
    cancelFrame();
    canvas.removeEventListener('pointermove',handleMove);
    canvas.removeEventListener('pointerdown',handleDown);
    canvas.removeEventListener('pointerup',handleUp);
    canvas.removeEventListener('pointercancel',handleUp);
    canvas.removeEventListener('wheel',handleWheel);
    canvas.removeEventListener('click',handleClick);
    canvas.removeEventListener('webglcontextlost',handleContextLost);
    clearGroup(content);
    clearGroup(fanGroup);
    renderer.dispose?.();
  }

  function inspect(){
    return{pixelRatio,cruising,fanCameraFacing,rayThreshold:raycaster.params.Points.threshold,cameraDistance,worldRotation:{x:world.rotation.x||0,y:world.rotation.y||0},disposed,contextLost,state};
  }

  renderContent();
  return{setState,focusNode,resize,pick,zoomBy,setCruising,resetView,restoreContext,dispose,inspect};
}
