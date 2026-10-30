import {VISUAL_CONFIG} from './visual-config.js?v=20261028-three1';

const TECHNICAL_CLASSES=new Set(['control','data','power','state','diagnostic']);

export function relationClass(edge={}){
  if(edge.pathClass==='hierarchy-secondary'||edge.type==='secondary_contains')return 'hierarchy-secondary';
  if(edge.pathClass==='hierarchy'||edge.type==='primary_contains')return 'hierarchy';
  if(TECHNICAL_CLASSES.has(edge.pathClass))return edge.pathClass;
  if(edge.type==='secondary_membership'||edge.type==='hierarchy-secondary')return 'hierarchy-secondary';
  return 'hierarchy';
}

function nodeColor(node={}){
  if(node.kind==='root')return VISUAL_CONFIG.root;
  if(node.kind==='architecture_dimension')return VISUAL_CONFIG.dimension;
  if(node.kind==='architecture_chain'||node.hierarchyLevel===2)return VISUAL_CONFIG.topic;
  return VISUAL_CONFIG.detail;
}

export function nodeVisual(node={},context={}){
  const emphasized=context.selected||context.hovered||context.onActivePath;
  const primary=node.kind==='root'||node.kind==='architecture_dimension';
  return{
    color:emphasized?VISUAL_CONFIG.activeGold:nodeColor(node),
    opacity:context.dimmed?.25:(context.hovered||context.selected?1:VISUAL_CONFIG.pointOpacity),
    size:emphasized?(primary?VISUAL_CONFIG.maxPrimaryNodePixels:VISUAL_CONFIG.maxDetailNodePixels):primary?8:4,
    halo:context.selected?.34:context.hovered?.18:0
  };
}

export function edgeVisual(edge={},context={}){
  const kind=relationClass(edge);
  const active=Boolean(context.active);
  const technical=TECHNICAL_CLASSES.has(kind);
  const palette={
    hierarchy:VISUAL_CONFIG.hierarchy,
    'hierarchy-secondary':VISUAL_CONFIG.hierarchySecondary,
    control:VISUAL_CONFIG.control,
    data:VISUAL_CONFIG.data,
    power:VISUAL_CONFIG.power,
    state:VISUAL_CONFIG.state,
    diagnostic:VISUAL_CONFIG.diagnostic
  };
  const baseOpacity=kind==='hierarchy-secondary'
    ?VISUAL_CONFIG.secondaryEdgeOpacity
    :technical?VISUAL_CONFIG.inactiveEdgeOpacity:VISUAL_CONFIG.hierarchyEdgeOpacity;
  return{
    kind,
    color:active?VISUAL_CONFIG.activeGold:palette[kind],
    opacity:active?VISUAL_CONFIG.activeEdgeOpacity:baseOpacity,
    linewidth:active?1.35:.75
  };
}

function colorValue(THREE,color){
  return THREE.Color?new THREE.Color(color):color;
}

export function createNodeCloud(THREE,nodes=[],positions=new Map(),visuals=new Map()){
  const geometry=new THREE.BufferGeometry();
  const coordinates=[];
  const colors=[];
  const sizes=[];
  for(const node of nodes){
    const position=positions.get(node.id);
    if(!position)continue;
    const visual=visuals.get(node.id)||nodeVisual(node,{});
    coordinates.push(position.x,position.y,position.z);
    const color=colorValue(THREE,visual.color);
    if(color?.r!==undefined)colors.push(color.r,color.g,color.b);
    sizes.push(visual.size);
  }
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(coordinates,3));
  if(colors.length)geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute('size',new THREE.Float32BufferAttribute(sizes,1));
  const material=THREE.ShaderMaterial?new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,vertexColors:true,blending:THREE.AdditiveBlending,
    vertexShader:'attribute float size; attribute vec3 color; varying vec3 vColor; void main(){vColor=color; vec4 mvPosition=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*(420.0/max(220.0,-mvPosition.z)); gl_Position=projectionMatrix*mvPosition;}',
    fragmentShader:'varying vec3 vColor; void main(){float d=distance(gl_PointCoord,vec2(0.5)); if(d>0.5) discard; float core=smoothstep(0.5,0.05,d); float glow=smoothstep(0.5,0.18,d); gl_FragColor=vec4(vColor,clamp(core*0.72+glow*0.38,0.0,1.0));}'
  }):new THREE.PointsMaterial({size:4,sizeAttenuation:true,vertexColors:Boolean(colors.length),color:colors.length?0xffffff:VISUAL_CONFIG.dimension,transparent:true,opacity:VISUAL_CONFIG.pointOpacity,depthWrite:false,blending:THREE.AdditiveBlending});
  const points=new THREE.Points(geometry,material);
  points.userData.nodeIds=nodes.filter(node=>positions.has(node.id)).map(node=>node.id);
  return points;
}

export function createEdgeBatches(THREE,edges=[],positions=new Map(),activeEdgeIds=new Set()){
  const grouped=new Map();
  for(const edge of edges){
    const start=positions.get(edge.from);
    const end=positions.get(edge.to);
    if(!start||!end)continue;
    const kind=relationClass(edge);
    if(!grouped.has(kind))grouped.set(kind,[]);
    grouped.get(kind).push(start.x,start.y,start.z,end.x,end.y,end.z);
  }
  const batches=new Map();
  for(const [kind,vertices] of grouped){
    const visual=edgeVisual({type:kind,pathClass:TECHNICAL_CLASSES.has(kind)?kind:undefined},{
      active:activeEdgeIds.has(kind)
    });
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    const material=new THREE.LineBasicMaterial({
      color:visual.color,
      transparent:true,
      opacity:visual.opacity,
      depthWrite:false,
      blending:THREE.NormalBlending
    });
    const segments=new THREE.LineSegments(geometry,material);
    segments.userData.relationClass=kind;
    batches.set(kind,segments);
  }
  return batches;
}

export function createActiveFan(THREE,curves=[]){
  const group=new THREE.Group();
  for(const curve of curves){
    const points=curve.points.map(point=>new THREE.Vector3(point.x,point.y,point.z));
    const path=points.length===4
      ?new THREE.CubicBezierCurve3(points[0],points[1],points[2],points[3])
      :new THREE.CatmullRomCurve3(points);
    const geometry=new THREE.BufferGeometry().setFromPoints(path.getPoints(28));
    const material=new THREE.LineBasicMaterial({
      color:VISUAL_CONFIG.activeGold,
      transparent:true,
      opacity:.58,
      depthWrite:false
    });
    const line=new THREE.Line(geometry,material);
    line.userData.nodeId=curve.id;
    group.add(line);
  }
  return group;
}
