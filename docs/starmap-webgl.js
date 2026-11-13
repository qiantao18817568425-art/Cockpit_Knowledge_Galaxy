import {visibleNodeIds} from './graph-model.js?v=20261114-webgl3';
import {buildStarmapLayout,buildStarmapView,drillVisibleNodeIds,hierarchyRoute} from './space-scene.js?v=20261114-webgl3';

const RELEASE='20261114-webgl3';
const PATH_COLORS={hierarchy:'#7897a8','hierarchy-secondary':'#486677',control:'#90b6cb',data:'#80beb8',power:'#d1ae74',state:'#aaa5c1',diagnostic:'#9ab5ba'};
const FEATURED_ROUTE=['architecture:mcu-soc','architecture:power','architecture:android-hmi-display'];
const REGION_COLORS={
  'architecture:mcu-soc':'#ffc479','architecture:power':'#ffc777',
  'architecture:android-hmi-display':'#72b8ff','architecture:virtual-communication':'#54d9df',
  'architecture:audio':'#a6adff','architecture:diagnosis-evidence':'#7ce9f4',
  'architecture:camera-perception':'#55d3e6','architecture:mtk-platform':'#8daeff'
};
export function buildRenderableStarmap(graph,state={}){
  const zoom=state.zoom??1;
  const selectedId=state.selectedId||null;
  const matchingIds=new Set(state.matchingIds||[]);
  const allowedIds=visibleNodeIds(graph,{selectedId,platforms:state.platforms||[],pathClasses:state.pathClasses||[],evidenceVisible:Boolean(state.evidenceVisible),candidateVisible:false});
  const drillIds=selectedId?drillVisibleNodeIds(graph,{selectedId,expandedDepth:1,evidenceVisible:Boolean(state.evidenceVisible),technicalNeighborLimit:5,matchingIds}):[];
  if(selectedId){
    const children=graph.nodes.filter(node=>node.primaryParentId===selectedId&&!['source','evidence'].includes(node.kind))
      .sort((a,b)=>(a.hierarchyOrder??0)-(b.hierarchyOrder??0)||a.id.localeCompare(b.id))
      .slice(0,12);
    for(const child of children)drillIds.add(child.id);
  }
  const focusIds=new Set(selectedId?drillIds:graph.nodes.filter(node=>node.kind==='root'||node.kind==='architecture_dimension').map(node=>node.id));
  if(selectedId)for(const id of hierarchyRoute(graph,selectedId))focusIds.add(id);
  for(const id of [...allowedIds])if(!focusIds.has(id))allowedIds.delete(id);
  if(selectedId)for(const id of hierarchyRoute(graph,selectedId))allowedIds.add(id);
  const view=buildStarmapView(graph,{zoom,selectedId,hoveredId:state.hoveredId||null,allowedIds,drillIds,matchingIds,hiddenKinds:state.hiddenKinds||[]});
  const positions=state.positions||buildStarmapLayout(graph);
  const byId=new Map(graph.nodes.map(node=>[node.id,node]));
  const backgroundIds=new Set();
  let routeIds=view.routeIds,routeEdges=view.routeEdges;
  if(!selectedId&&!state.hoveredId){
    const featuredEdges=[];
    for(let index=1;index<FEATURED_ROUTE.length;index++){
      const from=FEATURED_ROUTE[index-1],to=FEATURED_ROUTE[index];
      const edge=graph.edges.find(item=>item.from===from&&item.to===to);
      if(!edge||!view.visibleIds.has(from)||!view.visibleIds.has(to)||
        (state.pathClasses?.length&&!state.pathClasses.includes(edge.pathClass))){featuredEdges.length=0;break}
      featuredEdges.push([from,to]);
    }
    if(featuredEdges.length===FEATURED_ROUTE.length-1){routeIds=FEATURED_ROUTE;routeEdges=featuredEdges}
  }
  const routeKeys=new Set(routeEdges.map(([from,to])=>`${from}|${to}`));
  const edges=graph.edges.filter(edge=>{
    if(!view.visibleIds.has(edge.from)||!view.visibleIds.has(edge.to))return false;
    const onRoute=routeKeys.has(`${edge.from}|${edge.to}`);
    if(!selectedId&&!state.hoveredId)return onRoute;
    if(edge.pathClass==='index'||edge.type==='课程顺序')return onRoute||Boolean(state.sequenceVisible&&edge.type==='课程顺序');
    if(edge.pathClass==='hierarchy'&&(byId.get(edge.from)?.kind==='root'||byId.get(edge.to)?.kind==='root')&&!onRoute)return false;
    if(state.pathClasses?.length&&!state.pathClasses.includes(edge.pathClass)&&!onRoute)return false;
    return true;
  });
  return{positions,visibleIds:view.visibleIds,backgroundIds,routeIds,routeEdges,emphasisIds:view.emphasisIds,edges};
}

function schedulerDefault(){return{request:callback=>requestAnimationFrame(callback),cancel:id=>cancelAnimationFrame(id)}}
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function damp(current,target,delta,timeConstant=260){return current+(target-current)*(1-Math.exp(-delta/timeConstant))}
export function autonomousPose(elapsedMs,{enabled=true}={}){
  if(!enabled)return{yaw:0,pitch:0,roll:0,dolly:0};
  const time=Math.max(0,elapsedMs)/1000;
  return{
    yaw:Math.sin(time*.42)*.15,
    pitch:Math.sin(time*.3)*.055,
    roll:Math.sin(time*.25)*.018,
    dolly:Math.sin(time*.55)*42
  };
}
function pointMaterial(THREE,{opacity=1,glow=1}={}){
  return new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,vertexColors:true,blending:THREE.AdditiveBlending,
    uniforms:{uOpacity:{value:opacity},uGlow:{value:glow}},
    vertexShader:'attribute float aSize; attribute float aAlpha; varying vec3 vColor; varying float vAlpha; void main(){vColor=color;vAlpha=aAlpha;vec4 v=modelViewMatrix*vec4(position,1.0);gl_PointSize=clamp(aSize*1320.0/max(250.0,-v.z),1.0,64.0);gl_Position=projectionMatrix*v;}',
    fragmentShader:'uniform float uOpacity; uniform float uGlow; varying vec3 vColor; varying float vAlpha; void main(){vec2 p=gl_PointCoord-vec2(.5);float r=length(p);if(r>.5)discard;float core=1.0-smoothstep(.015,.14,r);float halo=1.0-smoothstep(.12,.5,r);float rayX=(1.0-smoothstep(.0,.035,abs(p.y)))*(1.0-smoothstep(.08,.48,abs(p.x)));float rayY=(1.0-smoothstep(.0,.035,abs(p.x)))*(1.0-smoothstep(.08,.48,abs(p.y)));gl_FragColor=vec4(vColor,(core*.85+halo*.38*uGlow+(rayX+rayY)*.15)*vAlpha*uOpacity);}'
  });
}

function makePointCloud(THREE,entries,positions,visual){
  const xyz=[],rgb=[],sizes=[],alphas=[],ids=[];
  for(const node of entries){
    const point=positions.get(node.id);if(!point)continue;
    const style=visual(node);
    const color=new THREE.Color(style.color);
    xyz.push(point.x,point.y,point.z);rgb.push(color.r,color.g,color.b);
    sizes.push(style.size);alphas.push(style.alpha);ids.push(node.id);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));
  geometry.setAttribute('aSize',new THREE.Float32BufferAttribute(sizes,1));
  geometry.setAttribute('aAlpha',new THREE.Float32BufferAttribute(alphas,1));
  const points=new THREE.Points(geometry,pointMaterial(THREE));points.userData.nodeIds=ids;
  return points;
}

function disposeGroup(group){
  for(const item of [...group.children]){
    group.remove(item);
    item.traverse(child=>{child.geometry?.dispose?.();if(Array.isArray(child.material))child.material.forEach(material=>material?.dispose?.());else child.material?.dispose?.()});
  }
}

export function createStarmapScene({THREE,canvas,graph,onHover=()=>{},onSelect=()=>{},onContextLost=()=>{},onViewChange=()=>{},reducedMotion=false,rendererFactory,frameScheduler,visibilitySource=typeof document==='undefined'?null:document}={}){
  if(!THREE||!canvas||!graph)throw new Error('Three.js, canvas and graph are required');
  const scheduler=frameScheduler||schedulerDefault();
  const renderer=rendererFactory?rendererFactory({THREE,canvas}):new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setClearColor?.(0x000000,0);
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#020710',.00016);
  const camera=new THREE.PerspectiveCamera(46,1,1,4000);camera.position.set(0,0,1450);camera.lookAt(0,0,0);
  const world=new THREE.Group(),content=new THREE.Group();world.add(content);scene.add(world);
  const raycaster=new THREE.Raycaster();raycaster.params.Points.threshold=18;
  const pointer=new THREE.Vector2();
  const nodeById=new Map(graph.nodes.map(node=>[node.id,node]));
  const layoutPositions=buildStarmapLayout(graph);
  const routeOrb=new THREE.Mesh(new THREE.SphereGeometry(3.4,10,8),new THREE.MeshBasicMaterial({color:'#ffd499',transparent:true,opacity:.95,depthWrite:false}));
  routeOrb.visible=false;world.add(routeOrb);
  const state={selectedId:null,hoveredId:null,platforms:[],pathClasses:[],matchingIds:[],hiddenKinds:[],evidenceVisible:false,sequenceVisible:false};
  let model=null,interactiveCloud=null,frameId=null,disposed=false,contextLost=false,lastFrame=0,startTime=0;
  let intro=!reducedMotion,pixelRatio=1,cruising=!reducedMotion,zoom=1,zoomTarget=1;
  let cruiseTime=0,motionPose=autonomousPose(0);
  let yaw=reducedMotion?.18:.42,pitch=reducedMotion?-.22:-.42,yawVelocity=0,pitchVelocity=0,drag=null,hoverId=null;
  let focus={x:0,y:0,z:0},focusTarget={x:0,y:0,z:0},parallax={x:0,y:0},parallaxTarget={x:0,y:0};
  let routePhaseStart=0,width=1,height=1,zoomStage=0;
  const nodeColor=node=>{
    let current=node;
    while(current){if(REGION_COLORS[current.id])return REGION_COLORS[current.id];current=nodeById.get(current.primaryParentId)}
    return '#a7c6f5';
  };

  function requestFrame(){if(frameId!==null||disposed||contextLost||visibilitySource?.hidden)return;frameId=scheduler.request(frame)}
  function cancelFrame(){if(frameId===null)return;scheduler.cancel(frameId);frameId=null}
  function rebuild(){
    model=buildRenderableStarmap(graph,{...state,zoom,positions:layoutPositions});
    disposeGroup(content);
    const foreground=graph.nodes.filter(node=>model.visibleIds.has(node.id));
    const background=graph.nodes.filter(node=>model.backgroundIds.has(node.id));
    const routeSet=new Set(model.routeIds);
    interactiveCloud=makePointCloud(THREE,foreground,model.positions,node=>{
      const active=node.id===state.selectedId,hover=node.id===state.hoveredId,near=model.emphasisIds.has(node.id),route=routeSet.has(node.id);
      const major=node.kind==='root'||node.kind==='architecture_dimension';
      return{color:active||hover||route?'#ffd18e':nodeColor(node),size:active?31:hover?27:route?24:major?19:near?11:6.5,alpha:state.selectedId||state.hoveredId?active||hover||near||route?1:.38:1};
    });
    content.add(interactiveCloud);
    const hubs=foreground.filter(node=>node.kind==='root'||node.kind==='architecture_dimension');
    if(hubs.length)content.add(makePointCloud(THREE,hubs,model.positions,node=>({color:routeSet.has(node.id)?'#ffc77a':nodeColor(node),size:routeSet.has(node.id)?49:36,alpha:routeSet.has(node.id)?.3:.17})));
    if(background.length)content.add(makePointCloud(THREE,background,model.positions,node=>({color:nodeColor(node),size:3.3,alpha:.28})));
    const grouped=new Map();
    const routeKeys=new Set(model.routeEdges.map(([from,to])=>`${from}|${to}`));
    for(const edge of model.edges){
      if(routeKeys.has(`${edge.from}|${edge.to}`))continue;
      const a=model.positions.get(edge.from),b=model.positions.get(edge.to);if(!a||!b)continue;
      const dimmed=Boolean(state.selectedId||state.hoveredId)&&![edge.from,edge.to].some(id=>model.emphasisIds.has(id));
      const distant=model.backgroundIds.has(edge.from)||model.backgroundIds.has(edge.to);
      const key=`${edge.pathClass||'hierarchy'}:${distant?'far':dimmed?'dim':'normal'}`;
      if(!grouped.has(key))grouped.set(key,[]);
      grouped.get(key).push(a.x,a.y,a.z,b.x,b.y,b.z);
    }
    for(const [key,vertices] of grouped){
      const [pathClass,level]=key.split(':');
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      const opacity=level==='far'?.075:level==='dim'?.055:pathClass==='hierarchy-secondary'?.085:.25;
      content.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:PATH_COLORS[pathClass]||'#7795a9',transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false})));
    }
    if(model.routeEdges.length){
      const vertices=[];
      for(const [from,to] of model.routeEdges){const a=model.positions.get(from),b=model.positions.get(to);if(a&&b)vertices.push(a.x,a.y,a.z,b.x,b.y,b.z)}
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      content.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#ffce82',transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false})));
      for(const [from,to] of model.routeEdges){
        const a=model.positions.get(from),b=model.positions.get(to);if(!a||!b)continue;
        const start=new THREE.Vector3(a.x,a.y,a.z),end=new THREE.Vector3(b.x,b.y,b.z),direction=end.clone().sub(start);
        const halo=new THREE.Mesh(new THREE.CylinderGeometry(4.2,4.2,direction.length(),7,1,true),new THREE.MeshBasicMaterial({color:'#ffb759',transparent:true,opacity:.1,blending:THREE.AdditiveBlending,depthWrite:false}));
        halo.position.copy(start).add(end).multiplyScalar(.5);
        halo.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
        content.add(halo);
      }
      routeOrb.visible=cruising;routePhaseStart=cruiseTime;
    }else routeOrb.visible=false;
    requestFrame();
  }

  function labels(){
    if(!width||!height||!model)return;
    world.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const wanted=new Set([state.selectedId,state.hoveredId,...model.routeIds].filter(Boolean));
    const dimensions=graph.nodes.filter(node=>node.kind==='architecture_dimension'&&model.visibleIds.has(node.id)).map(node=>{
      const point=model.positions.get(node.id),worldPoint=new THREE.Vector3(point.x,point.y,point.z).applyMatrix4(world.matrixWorld).project(camera);
      return{node,projected:worldPoint};
    }).filter(item=>Math.abs(item.projected.x)<.96&&Math.abs(item.projected.y)<.9&&item.projected.z<1).sort((a,b)=>a.projected.z-b.projected.z).slice(0,width>=1500?7:5);
    for(const item of dimensions)wanted.add(item.node.id);
    const visible=[];
    for(const id of wanted){
      if(!model.visibleIds.has(id))continue;
      const node=nodeById.get(id),point=model.positions.get(id);if(!node||!point)continue;
      const projected=new THREE.Vector3(point.x,point.y,point.z).applyMatrix4(world.matrixWorld).project(camera);
      if(Math.abs(projected.x)>1||Math.abs(projected.y)>1||projected.z>1)continue;
      visible.push({id,title:node.title,x:(projected.x+1)*width/2,y:(1-projected.y)*height/2,active:id===state.selectedId,hovered:id===state.hoveredId,featured:!state.selectedId&&!state.hoveredId&&model.routeIds.includes(id),depth:projected.z});
    }
    const spaced=[];
    for(const item of visible){
      const important=item.active||item.hovered||item.featured||model.routeIds.includes(item.id);
      if(!important&&(item.x<250||spaced.some(other=>Math.abs(item.x-other.x)<Math.min(210,Math.max(105,item.title.length*12))&&Math.abs(item.y-other.y)<32)))continue;
      spaced.push(item);
    }
    onViewChange({labels:spaced,visibleCount:model.visibleIds.size,routeIds:model.routeIds});
  }

  function frame(time){
    frameId=null;if(disposed||contextLost||visibilitySource?.hidden)return;
    if(!startTime)startTime=time;
    const delta=clamp(time-(lastFrame||time),0,50);lastFrame=time;
    if(cruising&&!drag){cruiseTime+=delta;motionPose=autonomousPose(cruiseTime)}
    if(intro){const t=clamp((time-startTime)/1500,0,1),ease=1-Math.pow(1-t,3);yaw=.42-.24*ease;pitch=-.42+.2*ease;zoom=.67+.33*ease;if(t>=1)intro=false}
    else zoom=reducedMotion?zoomTarget:damp(zoom,zoomTarget,delta);
    const stage=zoom<1.35?0:zoom<1.75?1:2;if(stage!==zoomStage){zoomStage=stage;rebuild()}
    for(const key of ['x','y','z'])focus[key]=reducedMotion?focusTarget[key]:damp(focus[key],focusTarget[key],delta);
    for(const key of ['x','y'])parallax[key]=reducedMotion?parallaxTarget[key]:damp(parallax[key],parallaxTarget[key],delta,180);
    if(!drag){yaw+=yawVelocity*delta;pitch=clamp(pitch+pitchVelocity*delta,-1.05,1.05);const friction=Math.exp(-delta/380);yawVelocity*=friction;pitchVelocity*=friction}
    const pose=motionPose;
    const motionScale=state.selectedId?.45:1;
    world.rotation.set(pitch+pose.pitch*motionScale,yaw+pose.yaw*motionScale,pose.roll*motionScale);
    world.position.set(-focus.x+(state.selectedId?-225:0)+parallax.x,-focus.y+parallax.y,-focus.z);
    camera.position.z=1320/zoom+pose.dolly*motionScale;
    if(routeOrb.visible&&model.routeEdges.length){
      const phase=((cruiseTime-routePhaseStart)%2500)/2500*model.routeEdges.length;
      const index=Math.min(model.routeEdges.length-1,Math.floor(phase)),t=phase-index;
      const [from,to]=model.routeEdges[index],a=model.positions.get(from),b=model.positions.get(to);
      if(a&&b)routeOrb.position.set(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t);
    }
    renderer.render(scene,camera);labels();
    const moving=intro||Boolean(drag)||cruising||routeOrb.visible||
      Math.abs(yawVelocity)>.00001||Math.abs(pitchVelocity)>.00001||Math.abs(zoom-zoomTarget)>.002||
      Math.hypot(focus.x-focusTarget.x,focus.y-focusTarget.y,focus.z-focusTarget.z)>.5||
      Math.hypot(parallax.x-parallaxTarget.x,parallax.y-parallaxTarget.y)>.2;
    if(moving)requestFrame();
  }

  function pick(event){
    if(!interactiveCloud||!width||!height)return null;
    const bounds=canvas.getBoundingClientRect();
    pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObject(interactiveCloud,false)?.[0];
    return hit?interactiveCloud.userData.nodeIds[hit.index]||null:null;
  }
  function handleDown(event){drag={x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,lastTime:performance.now(),yaw,pitch,moved:false};yawVelocity=0;pitchVelocity=0;canvas.setPointerCapture?.(event.pointerId);intro=false;requestFrame()}
  function handleMove(event){
    if(drag){const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;
      if(drag.moved){const now=performance.now(),step=Math.max(8,now-drag.lastTime);yaw=drag.yaw+dx*.0046;pitch=clamp(drag.pitch+dy*.0034,-1.05,1.05);yawVelocity=reducedMotion?0:clamp((event.clientX-drag.lastX)*.0046/step,-.004,.004);pitchVelocity=reducedMotion?0:clamp((event.clientY-drag.lastY)*.0034/step,-.003,.003);drag.lastX=event.clientX;drag.lastY=event.clientY;drag.lastTime=now;requestFrame()}return}
    const bounds=canvas.getBoundingClientRect();parallaxTarget.x=reducedMotion?0:clamp((event.clientX-bounds.left)/bounds.width*2-1,-1,1)*8;parallaxTarget.y=reducedMotion?0:clamp((event.clientY-bounds.top)/bounds.height*2-1,-1,1)*6;
    const id=pick(event);if(id!==hoverId){hoverId=id;state.hoveredId=id;rebuild();onHover(id)}requestFrame();
  }
  function handleUp(event){if(drag&&!drag.moved)onSelect(pick(event));drag=null;requestFrame()}
  function handleCancel(){drag=null;yawVelocity=0;pitchVelocity=0;requestFrame()}
  function handleLeave(){parallaxTarget.x=0;parallaxTarget.y=0;if(hoverId){hoverId=null;state.hoveredId=null;rebuild();onHover(null)}requestFrame()}
  function handleWheel(event){event.preventDefault();zoomBy(event.deltaY<0?1.12:1/1.12)}
  function handleContextLost(event){event.preventDefault?.();if(contextLost)return;contextLost=true;cancelFrame();onContextLost({selectedId:state.selectedId})}
  function handleVisibility(){if(visibilitySource?.hidden)cancelFrame();else{lastFrame=0;requestFrame()}}
  canvas.addEventListener('pointerdown',handleDown);canvas.addEventListener('pointermove',handleMove);canvas.addEventListener('pointerup',handleUp);canvas.addEventListener('pointercancel',handleCancel);canvas.addEventListener('pointerleave',handleLeave);canvas.addEventListener('wheel',handleWheel,{passive:false});canvas.addEventListener('webglcontextlost',handleContextLost);
  visibilitySource?.addEventListener?.('visibilitychange',handleVisibility);

  function setState(next={}){const previous=state.selectedId;Object.assign(state,next);if(state.selectedId!==previous){const point=state.selectedId?model?.positions.get(state.selectedId):null;focusTarget=point?{...point}:{x:0,y:0,z:0};zoomTarget=state.selectedId?Math.max(1.42,zoomTarget):1}rebuild()}
  function resize({width:nextWidth,height:nextHeight,dpr=1}){width=Math.max(1,nextWidth);height=Math.max(1,nextHeight);pixelRatio=clamp(dpr,1,1.6);renderer.setPixelRatio(pixelRatio);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();requestFrame()}
  function zoomBy(factor){intro=false;zoomTarget=clamp(zoomTarget*factor,.64,2.05);requestFrame();return zoomTarget}
  function resetView(){focusTarget={x:0,y:0,z:0};zoomTarget=1;yaw=.18;pitch=-.22;yawVelocity=0;pitchVelocity=0;requestFrame()}
  function setCruising(value){cruising=Boolean(value);lastFrame=0;if(!cruising){intro=false;yawVelocity=0;pitchVelocity=0}routeOrb.visible=Boolean(model?.routeEdges.length&&cruising);requestFrame();return cruising}
  function dispose(){if(disposed)return;disposed=true;cancelFrame();visibilitySource?.removeEventListener?.('visibilitychange',handleVisibility);for(const [event,handler] of [['pointerdown',handleDown],['pointermove',handleMove],['pointerup',handleUp],['pointercancel',handleCancel],['pointerleave',handleLeave],['wheel',handleWheel],['webglcontextlost',handleContextLost]])canvas.removeEventListener(event,handler);disposeGroup(content);routeOrb.geometry.dispose();routeOrb.material.dispose();renderer.dispose?.()}
  function inspect(){return{pixelRatio,cruising,selectedId:state.selectedId,visibleCount:model?.visibleIds.size,interactiveCount:interactiveCloud?.userData.nodeIds.length,backgroundCount:model?.backgroundIds.size,ambientPoints:0,ambientSegments:0,routeCount:model?.routeEdges.length,zoom,focus:{...focus},focusTarget:{...focusTarget},disposed,contextLost,release:RELEASE}}
  rebuild();requestFrame();
  return{setState,resize,zoomBy,resetView,setCruising,dispose,inspect};
}
