import {visibleNodeIds} from './graph-model.js?v=20261113-webgl2';
import {buildStarmapLayout,buildStarmapView,drillVisibleNodeIds,hierarchyRoute,starmapBackgroundIds} from './space-scene.js?v=20261113-webgl2';

const RELEASE='20261113-webgl2';
const PATH_COLORS={hierarchy:'#7897a8','hierarchy-secondary':'#486677',control:'#90b6cb',data:'#80beb8',power:'#d1ae74',state:'#aaa5c1',diagnostic:'#9ab5ba'};
const VALID_BACKGROUND=new Set(['hierarchy','hierarchy-secondary','control','data','power']);
const FEATURED_ROUTE=['architecture:mcu-soc','architecture:power','architecture:android-hmi-display'];
const REGION_COLORS={
  'architecture:mcu-soc':'#ffc479','architecture:power':'#ffc777',
  'architecture:android-hmi-display':'#72b8ff','architecture:virtual-communication':'#54d9df',
  'architecture:audio':'#a6adff','architecture:diagnosis-evidence':'#7ce9f4',
  'architecture:camera-perception':'#55d3e6','architecture:mtk-platform':'#8daeff'
};
const COOL_COLORS=['#91beff','#80d5f7','#a9b9ff','#68d6e8','#9dd6ec'];

export function buildRenderableStarmap(graph,state={}){
  const zoom=state.zoom??1;
  const selectedId=state.selectedId||null;
  const matchingIds=new Set(state.matchingIds||[]);
  const allowedIds=visibleNodeIds(graph,{selectedId,platforms:state.platforms||[],pathClasses:state.pathClasses||[],evidenceVisible:Boolean(state.evidenceVisible),candidateVisible:false});
  if(selectedId)for(const id of hierarchyRoute(graph,selectedId))allowedIds.add(id);
  const drillIds=selectedId?drillVisibleNodeIds(graph,{selectedId,expandedDepth:1,evidenceVisible:Boolean(state.evidenceVisible),matchingIds}):[];
  const view=buildStarmapView(graph,{zoom,selectedId,hoveredId:state.hoveredId||null,allowedIds,drillIds,matchingIds,hiddenKinds:state.hiddenKinds||[]});
  const positions=state.positions||buildStarmapLayout(graph);
  const byId=new Map(graph.nodes.map(node=>[node.id,node]));
  const backgroundIds=new Set([...starmapBackgroundIds(graph,{zoom})].filter(id=>allowedIds.has(id)&&!view.visibleIds.has(id)&&!(state.hiddenKinds||[]).includes(byId.get(id)?.kind)));
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
  const visibleOrBackground=new Set([...view.visibleIds,...backgroundIds]);
  const edges=graph.edges.filter(edge=>{
    if(!visibleOrBackground.has(edge.from)||!visibleOrBackground.has(edge.to))return false;
    const onRoute=routeKeys.has(`${edge.from}|${edge.to}`);
    if(edge.pathClass==='index'||edge.type==='课程顺序')return onRoute||Boolean(state.sequenceVisible&&edge.type==='课程顺序');
    if(edge.pathClass==='hierarchy'&&(byId.get(edge.from)?.kind==='root'||byId.get(edge.to)?.kind==='root')&&!onRoute)return false;
    if((backgroundIds.has(edge.from)||backgroundIds.has(edge.to))&&!VALID_BACKGROUND.has(edge.pathClass))return false;
    if(state.pathClasses?.length&&!state.pathClasses.includes(edge.pathClass)&&!onRoute)return false;
    return true;
  });
  return{positions,visibleIds:view.visibleIds,backgroundIds,routeIds,routeEdges,emphasisIds:view.emphasisIds,edges};
}

function schedulerDefault(){return{request:callback=>requestAnimationFrame(callback),cancel:id=>cancelAnimationFrame(id)}}
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function damp(current,target,delta,timeConstant=260){return current+(target-current)*(1-Math.exp(-delta/timeConstant))}
function makeRandom(seed){let value=seed>>>0;return()=>((value=(Math.imul(value,1664525)+1013904223)>>>0)/4294967296)}

// These filaments are scenic geometry. Indices never enter graph edges or picking.
export function buildAtmosphericFilaments(graph,positions=buildStarmapLayout(graph)){
  const random=makeRandom(972341),points=[],segments=[],seen=new Set();
  const dimensions=graph.nodes.filter(node=>node.kind==='architecture_dimension');
  const add=(id,x,y,z,color,size,alpha)=>{points.push({id,x,y,z,color,size,alpha});return points.length-1};
  const connect=(start,end,maxDistance,neighbors=3)=>{
    const maxSquared=maxDistance*maxDistance;
    for(let index=start;index<end;index++){
      const p=points[index],nearest=[];
      for(let other=start;other<end;other++){
        if(index===other)continue;
        const q=points[other],distance=(p.x-q.x)**2+(p.y-q.y)**2+(p.z-q.z)**2;
        if(distance>maxSquared)continue;
        nearest.push([distance,other]);
      }
      nearest.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
      for(const [,other] of nearest.slice(0,neighbors)){
        const a=Math.min(index,other),b=Math.max(index,other),key=`${a}:${b}`;
        if(seen.has(key))continue;
        seen.add(key);segments.push([a,b]);
      }
    }
  };
  for(const [region,node] of dimensions.entries()){
    const center=positions.get(node.id);if(!center)continue;
    const start=points.length,color=REGION_COLORS[node.id]||COOL_COLORS[region%COOL_COLORS.length];
    const count=Math.abs(center.x)<350?170:116;
    for(let index=0;index<count;index++){
      const angle=random()*Math.PI*2,radius=Math.sqrt(random())*(100+random()*92);
      const x=center.x+Math.cos(angle)*radius,y=center.y+Math.sin(angle)*radius*.7;
      const z=center.z+(random()-.5)*260;
      add(`filament:${region}:${index}`,x,y,z,color,1.6+random()*3.8,.22+random()*.52);
    }
    connect(start,points.length,146,3);
  }
  const bandStart=points.length;
  for(let index=0;index<470;index++){
    const x=(random()-.5)*1640,y=(random()-.5)*300+Math.sin(x/165)*35,z=(random()-.5)*330+75;
    const color=COOL_COLORS[Math.floor(random()*COOL_COLORS.length)];
    add(`filament:band:${index}`,x,y,z,color,1.3+random()*3.4,.14+random()*.48);
  }
  connect(bandStart,points.length,104,2);
  const spineStart=points.length;
  for(let index=0;index<650;index++){
    const x=(random()-.5)*1390,y=(random()-.5)*340-Math.sin(x/260)*35,z=(random()-.5)*340+110;
    add(`filament:spine:${index}`,x,y,z,random()>.28?'#c6d4ff':'#8dc7ff',1.7+random()*4.5,.38+random()*.48);
  }
  connect(spineStart,points.length,132,4);
  const canopyStart=points.length;
  for(let index=0;index<450;index++){
    const x=(random()-.5)*2050,y=300+random()*300,z=(random()-.5)*440-40;
    add(`filament:canopy:${index}`,x,y,z,COOL_COLORS[Math.floor(random()*COOL_COLORS.length)],1.2+random()*2.8,.13+random()*.38);
  }
  connect(canopyStart,points.length,172,2);
  const foregroundStart=points.length;
  for(let index=0;index<125;index++){
    const x=(random()-.5)*2050,y=-105-random()*255,z=350+random()*440;
    const bright=random()>.83;
    add(`filament:foreground:${index}`,x,y,z,bright?'#eef7ff':'#79bdf5',bright?20+random()*18:3+random()*7,bright?1:.25+random()*.5);
  }
  connect(foregroundStart,points.length,205,2);
  const lowerStart=points.length;
  for(let index=0;index<310;index++){
    const x=(random()-.5)*2150,y=-285-random()*270,z=(random()-.5)*480+100;
    add(`filament:lower:${index}`,x,y,z,random()>.3?'#7fc7ff':'#55dce8',1.5+random()*4,.16+random()*.44);
  }
  connect(lowerStart,points.length,186,2);
  return{points,segments};
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
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#020710',.00016);
  const camera=new THREE.PerspectiveCamera(46,1,1,4000);camera.position.set(0,0,1450);camera.lookAt(0,0,0);
  const world=new THREE.Group(),content=new THREE.Group(),atmosphere=new THREE.Group();world.add(content,atmosphere);scene.add(world);
  const raycaster=new THREE.Raycaster();raycaster.params.Points.threshold=18;
  const pointer=new THREE.Vector2();
  const nodeById=new Map(graph.nodes.map(node=>[node.id,node]));
  const layoutPositions=buildStarmapLayout(graph);
  const ambient=buildAtmosphericFilaments(graph,layoutPositions);
  const ambientPositions=new Map(ambient.points.map(point=>[point.id,point]));
  atmosphere.add(makePointCloud(THREE,ambient.points,ambientPositions,point=>({color:point.color,size:point.size,alpha:point.alpha})));
  const lineVertices=[],lineColors=[];
  for(const [from,to] of ambient.segments){
    const a=ambient.points[from],b=ambient.points[to],colorA=new THREE.Color(a.color),colorB=new THREE.Color(b.color);
    lineVertices.push(a.x,a.y,a.z,b.x,b.y,b.z);
    lineColors.push(colorA.r,colorA.g,colorA.b,colorB.r,colorB.g,colorB.b);
  }
  const filamentGeometry=new THREE.BufferGeometry();
  filamentGeometry.setAttribute('position',new THREE.Float32BufferAttribute(lineVertices,3));
  filamentGeometry.setAttribute('color',new THREE.Float32BufferAttribute(lineColors,3));
  atmosphere.add(new THREE.LineSegments(filamentGeometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.2,blending:THREE.AdditiveBlending,depthWrite:false})));
  const dustRandom=makeRandom(549204);
  const dustPoints=Array.from({length:1300},(_,index)=>({id:`dust-${index}`}));
  const dustPositions=new Map(dustPoints.map(node=>{const r=Math.pow(dustRandom(),.7)*950,a=dustRandom()*Math.PI*2;return[node.id,{x:Math.cos(a)*r,y:(dustRandom()-.5)*760,z:Math.sin(a)*r*.85+(dustRandom()-.5)*520}]}));
  atmosphere.add(makePointCloud(THREE,dustPoints,dustPositions,node=>({color:dustRandom()>.9?'#c9b18d':'#83a6ba',size:1.7+dustRandom()*2.1,alpha:.09+dustRandom()*.23})));
  const routeOrb=new THREE.Mesh(new THREE.SphereGeometry(3.4,10,8),new THREE.MeshBasicMaterial({color:'#ffd499',transparent:true,opacity:.95,depthWrite:false}));
  routeOrb.visible=false;world.add(routeOrb);
  const state={selectedId:null,hoveredId:null,platforms:[],pathClasses:[],matchingIds:[],hiddenKinds:[],evidenceVisible:false,sequenceVisible:false};
  let model=null,interactiveCloud=null,frameId=null,disposed=false,contextLost=false,lastFrame=0,startTime=0;
  let intro=!reducedMotion,pixelRatio=1,cruising=!reducedMotion,zoom=1,zoomTarget=1;
  let yaw=reducedMotion?.18:.42,pitch=reducedMotion?-.22:-.42,yawVelocity=0,pitchVelocity=0,drag=null,hoverId=null;
  let focus={x:0,y:0,z:0},focusTarget={x:0,y:0,z:0},parallax={x:0,y:0},parallaxTarget={x:0,y:0};
  let routeStart=0,width=1,height=1,zoomStage=0;
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
      routeOrb.visible=!reducedMotion&&cruising;routeStart=performance.now();
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
    if(intro){const t=clamp((time-startTime)/1500,0,1),ease=1-Math.pow(1-t,3);yaw=.42-.24*ease;pitch=-.42+.2*ease;zoom=.67+.33*ease;if(t>=1)intro=false}
    else zoom=reducedMotion?zoomTarget:damp(zoom,zoomTarget,delta);
    const stage=zoom<1.35?0:zoom<1.75?1:2;if(stage!==zoomStage){zoomStage=stage;rebuild()}
    for(const key of ['x','y','z'])focus[key]=reducedMotion?focusTarget[key]:damp(focus[key],focusTarget[key],delta);
    for(const key of ['x','y'])parallax[key]=reducedMotion?parallaxTarget[key]:damp(parallax[key],parallaxTarget[key],delta,180);
    if(cruising&&!state.selectedId&&!drag&&!state.hoveredId)yaw+=delta*.000045;
    else if(!drag){yaw+=yawVelocity*delta;pitch=clamp(pitch+pitchVelocity*delta,-1.05,1.05);const friction=Math.exp(-delta/380);yawVelocity*=friction;pitchVelocity*=friction}
    world.rotation.set(pitch,yaw,0);
    world.position.set(-focus.x+(state.selectedId?-225:0)+parallax.x,-focus.y+parallax.y,-focus.z);
    camera.position.z=1320/zoom;
    if(routeOrb.visible&&model.routeEdges.length){
      const phase=((time-routeStart)%2500)/2500*model.routeEdges.length;
      const index=Math.min(model.routeEdges.length-1,Math.floor(phase)),t=phase-index;
      const [from,to]=model.routeEdges[index],a=model.positions.get(from),b=model.positions.get(to);
      if(a&&b)routeOrb.position.set(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t);
    }
    renderer.render(scene,camera);labels();
    const moving=intro||Boolean(drag)||Boolean(cruising&&!state.selectedId&&!state.hoveredId)||routeOrb.visible||
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

  function setState(next={}){const previous=state.selectedId;Object.assign(state,next);if(state.selectedId!==previous){const point=state.selectedId?model?.positions.get(state.selectedId):null;focusTarget=point?{...point}:{x:0,y:0,z:0};zoomTarget=state.selectedId?Math.max(1.42,zoomTarget):1;routeStart=performance.now()}rebuild()}
  function resize({width:nextWidth,height:nextHeight,dpr=1}){width=Math.max(1,nextWidth);height=Math.max(1,nextHeight);pixelRatio=clamp(dpr,1,1.6);renderer.setPixelRatio(pixelRatio);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();requestFrame()}
  function zoomBy(factor){intro=false;zoomTarget=clamp(zoomTarget*factor,.64,2.05);requestFrame();return zoomTarget}
  function resetView(){focusTarget={x:0,y:0,z:0};zoomTarget=1;yaw=.18;pitch=-.22;yawVelocity=0;pitchVelocity=0;requestFrame()}
  function setCruising(value){cruising=Boolean(value)&&!reducedMotion;routeOrb.visible=Boolean(model?.routeEdges.length&&cruising);requestFrame();return cruising}
  function dispose(){if(disposed)return;disposed=true;cancelFrame();visibilitySource?.removeEventListener?.('visibilitychange',handleVisibility);for(const [event,handler] of [['pointerdown',handleDown],['pointermove',handleMove],['pointerup',handleUp],['pointercancel',handleCancel],['pointerleave',handleLeave],['wheel',handleWheel],['webglcontextlost',handleContextLost]])canvas.removeEventListener(event,handler);disposeGroup(content);disposeGroup(atmosphere);routeOrb.geometry.dispose();routeOrb.material.dispose();renderer.dispose?.()}
  function inspect(){return{pixelRatio,cruising,selectedId:state.selectedId,visibleCount:model?.visibleIds.size,interactiveCount:interactiveCloud?.userData.nodeIds.length,backgroundCount:model?.backgroundIds.size,ambientPoints:ambient.points.length,ambientSegments:ambient.segments.length,routeCount:model?.routeEdges.length,zoom,focus:{...focus},focusTarget:{...focusTarget},disposed,contextLost,release:RELEASE}}
  rebuild();requestFrame();
  return{setState,resize,zoomBy,resetView,setCruising,dispose,inspect};
}
