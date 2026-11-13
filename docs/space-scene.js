const GOLDEN_ANGLE=Math.PI*(3-Math.sqrt(5));

function stableUnit(id){let n=2166136261;for(const char of id||''){n^=char.charCodeAt(0);n=Math.imul(n,16777619)}return(n>>>0)/4294967296}

// Irregular anchors keep the 17 architecture regions in one broad, navigable
// volume. They deliberately avoid the hollow shell used by the older view.
const STARMAP_ANCHORS=[
  [-650,230,-180],[-490,-90,60],[-440,-235,190],[470,140,130],[300,195,-140],
  [-300,85,-70],[565,-125,-90],[-145,185,110],[-10,205,-160],[235,-175,-110],
  [535,15,-180],[-585,30,160],[-25,-20,240],[200,285,-130],[-220,-280,-70],
  [510,-265,20],[255,-255,170]
];

export function buildStarmapLayout(graph){
  const nodes=graph?.nodes||[];
  const positions=new Map();
  const root=nodes.find(node=>node.kind==='root');
  if(root)positions.set(root.id,{x:0,y:0,z:0});
  const dimensions=nodes.filter(node=>node.kind==='architecture_dimension')
    .sort((a,b)=>(a.hierarchyOrder??0)-(b.hierarchyOrder??0)||a.id.localeCompare(b.id));
  dimensions.forEach((node,index)=>{
    const [x,y,z]=STARMAP_ANCHORS[index%STARMAP_ANCHORS.length];
    const repeat=Math.floor(index/STARMAP_ANCHORS.length);
    positions.set(node.id,{x:x+repeat*86,y:y-repeat*62,z:z+repeat*48});
  });
  const groups=new Map();
  for(const node of nodes){
    if(positions.has(node.id))continue;
    const parentId=node.primaryParentId||root?.id;
    if(!groups.has(parentId))groups.set(parentId,[]);
    groups.get(parentId).push(node);
  }
  const levels=[...new Set(nodes.map(node=>node.hierarchyLevel||0))].sort((a,b)=>a-b);
  for(const level of levels){
    if(level===0||level===1)continue;
    for(const [parentId,children] of groups){
      const parent=positions.get(parentId);
      if(!parent)continue;
      const siblings=children.filter(node=>(node.hierarchyLevel||0)===level)
        .sort((a,b)=>(a.hierarchyOrder??0)-(b.hierarchyOrder??0)||a.id.localeCompare(b.id));
      const radius=level===2?105:level===3?62:level===4?42:level===5?28:20;
      siblings.forEach((node,index)=>{
        const angle=index*GOLDEN_ANGLE+stableUnit(parentId)*Math.PI*2;
        const spread=Math.sqrt((index+.55)/Math.max(1,siblings.length));
        const distance=radius*(.42+.58*spread);
        const depth=(stableUnit(node.id)-.5)*radius*1.25;
        positions.set(node.id,{
          x:parent.x+Math.cos(angle)*distance,
          y:parent.y+Math.sin(angle)*distance*.82,
          z:parent.z+depth
        });
      });
    }
  }
  return positions;
}

export function starmapOverviewIds(graph,{zoom=1}={}){
  return new Set((graph?.nodes||[]).filter(node=>{
    if(node.kind==='root'||node.kind==='architecture_dimension')return true;
    if(node.kind==='source'||node.kind==='evidence')return false;
    if(node.kind==='lesson'||node.kind==='review')return zoom>=1.75;
    if(node.navigationOnly||['topic','chapter','subtopic'].includes(node.kind))return zoom>=1.35;
    return true;
  }).map(node=>node.id));
}

export function starmapBackgroundIds(graph,{zoom=1}={}){
  const foreground=starmapOverviewIds(graph,{zoom});
  return new Set((graph?.nodes||[]).filter(node=>
    node.navigationOnly&&!foreground.has(node.id)&&node.kind!=='source'&&node.kind!=='evidence'
  ).map(node=>node.id));
}

export function hierarchyRoute(graph,id){
  const byId=new Map((graph?.nodes||[]).map(node=>[node.id,node]));
  const route=[],seen=new Set();
  let current=byId.get(id);
  while(current&&!seen.has(current.id)){
    route.push(current.id);seen.add(current.id);
    current=byId.get(current.primaryParentId);
  }
  return route.reverse();
}

export function buildStarmapView(graph,{
  zoom=1,selectedId=null,hoveredId=null,allowedIds=null,drillIds=[],
  matchingIds=[],hiddenKinds=[]
}={}){
  const allowed=allowedIds?new Set(allowedIds):new Set((graph?.nodes||[]).map(node=>node.id));
  const hidden=new Set(hiddenKinds);
  const matches=new Set(matchingIds);
  const selectedRoute=selectedId?hierarchyRoute(graph,selectedId):[];
  const candidateIds=new Set([...starmapOverviewIds(graph,{zoom}),...drillIds,...matches,...selectedRoute]);
  const visibleIds=new Set((graph?.nodes||[]).filter(node=>
    candidateIds.has(node.id)&&(allowed.has(node.id)||matches.has(node.id)||node.id===selectedId)&&
    (node.kind==='root'||!hidden.has(node.kind))
  ).map(node=>node.id));
  const routeFocus=selectedId||hoveredId;
  const emphasisFocus=hoveredId||selectedId;
  const fullRoute=routeFocus?hierarchyRoute(graph,routeFocus):[];
  const routeIds=fullRoute.filter(id=>visibleIds.has(id));
  const routeEdges=[];
  for(let index=1;index<fullRoute.length;index++){
    const from=fullRoute[index-1],to=fullRoute[index];
    if(visibleIds.has(from)&&visibleIds.has(to))routeEdges.push([from,to]);
  }
  const emphasisIds=new Set(routeIds);
  if(visibleIds.has(emphasisFocus))emphasisIds.add(emphasisFocus);
  for(const edge of graph?.edges||[]){
    if(edge.from===emphasisFocus&&visibleIds.has(edge.to))emphasisIds.add(edge.to);
    if(edge.to===emphasisFocus&&visibleIds.has(edge.from))emphasisIds.add(edge.from);
  }
  return{visibleIds,routeIds,routeEdges,emphasisIds};
}

export function introStarmapPose(progress,{reducedMotion=false}={}){
  const t=reducedMotion?1:Math.max(0,Math.min(1,progress));
  const eased=1-Math.pow(1-t,3);
  return{yaw:.42-.24*eased,pitch:-.42+.2*eased,zoom:.67+.33*eased};
}

export function starmapParallax(x,y,{reducedMotion=false}={}){
  if(reducedMotion)return{x:0,y:0};
  const clamp=value=>Math.max(-1,Math.min(1,value));
  return{x:7*clamp(x),y:5*clamp(y)};
}

export function routeLightProgress(elapsedMs,pointCount,{durationMs=2400}={}){
  if(pointCount<2)return null;
  const segments=pointCount-1;
  const phase=((Math.max(0,elapsedMs)%durationMs)/durationMs)*segments;
  return{segment:Math.floor(phase),t:phase%1};
}

export function fibonacciSpherePoint(index,total,radius=1){
  const count=Math.max(1,total);
  const y=1-(index+.5)*2/count;
  const ring=Math.sqrt(Math.max(0,1-y*y));
  const angle=index*GOLDEN_ANGLE;
  return{x:Math.cos(angle)*ring*radius,y:y*radius,z:Math.sin(angle)*ring*radius};
}

export function buildArchitectureLayout(graph,{l2Radius=330,l3Radius=92,l4Spacing=58}={}){
  const positions=new Map([['root',{x:0,y:0,z:0}]]);
  const dimensions=graph.nodes.filter(node=>node.hierarchyLevel===1).sort((a,b)=>(a.hierarchyOrder??0)-(b.hierarchyOrder??0)||a.title.localeCompare(b.title,'zh-CN'));
  dimensions.forEach((node,index)=>positions.set(node.id,fibonacciSpherePoint(index,dimensions.length,l2Radius)));
  const maxLevel=Math.max(0,...graph.nodes.map(node=>node.hierarchyLevel||0));
  for(let level=2;level<=maxLevel;level++){
    const groups=new Map();
    for(const node of graph.nodes.filter(item=>item.hierarchyLevel===level)){
      const parent=node.primaryParentId||'root';if(!groups.has(parent))groups.set(parent,[]);groups.get(parent).push(node);
    }
    for(const [parentId,children] of groups){
      const parent=positions.get(parentId)||{x:0,y:0,z:0};
      children.sort((a,b)=>(a.hierarchyOrder??0)-(b.hierarchyOrder??0)||a.title.localeCompare(b.title,'zh-CN'));
      const radius=level===2?l3Radius:Math.max(30,l4Spacing-(level-3)*7);
      children.forEach((node,index)=>{
        const angle=index*Math.PI*2/Math.max(1,children.length)+stableUnit(parentId)*Math.PI*2;
        const tilt=(stableUnit(node.id)-.5)*radius*.9;
        positions.set(node.id,{x:parent.x+Math.cos(angle)*radius,y:parent.y+Math.sin(angle)*radius*.72,z:parent.z+tilt});
      });
    }
  }
  return positions;
}

export function edgeVisualStyle(edge){
  if(edge.type==='secondary_contains'||edge.pathClass==='hierarchy-secondary')return{alpha:.07,width:.55,color:'#596d92'};
  if(edge.type==='primary_contains'||edge.pathClass==='hierarchy')return{alpha:.23,width:1,color:'#7599c6'};
  if(edge.pathClass==='index')return{alpha:.06,width:.7,color:'#536b90'};
  if(edge.type==='课程顺序')return{alpha:.13,width:1,color:'#b5a4e7'};
  return{alpha:.23,width:edge.pathClass?1.15:1,color:'#7599c6'};
}

export function clampLabelX(x,textWidth,viewportWidth,padding=8){
  return Math.max(padding,Math.min(viewportWidth-textWidth-padding,x));
}

export function fitLabelSize({size,textWidth,availableWidth,minSize=5}){
  if(textWidth<=availableWidth)return size;
  return Math.max(minSize,Math.round(size*availableWidth/textWidth*100)/100);
}

export function isProjectedVisible({x,y,radius=0,width,height}){
  return x+radius>=0&&x-radius<=width&&y+radius>=0&&y-radius<=height;
}

export function starPulse(time,phase,reducedMotion=false){
  return reducedMotion?1:.72+.28*Math.sin(time*.0013+phase);
}

export function releaseVelocity(velocity,idleMs,expiryMs=90){
  return idleMs<=expiryMs?velocity:0;
}

export function selectFrontLabelIds(candidates,{limit=28,minDepth=30,forcedLimit=8}={}){
  const selected=new Set(candidates.filter(item=>item.kind==='root').map(item=>item.id));
  const forced=candidates
    .filter(item=>item.kind!=='root'&&item.forced&&item.onScreen)
    .sort((a,b)=>(b.forcePriority||0)-(a.forcePriority||0)||b.depth-a.depth)
    .slice(0,Math.max(0,forcedLimit));
  for(const item of forced)selected.add(item.id);
  const front=candidates
    .filter(item=>item.onScreen&&item.kind!=='root'&&!selected.has(item.id)&&item.depth>=minDepth)
    .sort((a,b)=>b.depth-a.depth)
    .slice(0,Math.max(0,limit));
  for(const item of front)selected.add(item.id);
  return selected;
}

export function frontLabelLimit(viewportWidth){
  return viewportWidth<720?6:viewportWidth<1400?12:16;
}

export function homeVisibleNodeIds(graph){
  return new Set(graph.nodes.filter(node=>node.id==='root'||(!node.hiddenByDefault&&Number.isInteger(node.hierarchyLevel)&&node.hierarchyLevel<=2)).map(node=>node.id));
}

export function visibleLabelIds(candidates,{mode='drill',hoveredId=null,selectedId=null,matchingIds=[],currentChainIds=[],limit=28,minDepth=30,forcedLimit=8,homeLimit=Infinity}={}){
  const interactions=new Set([hoveredId,selectedId,...(matchingIds||[]),...(currentChainIds||[])].filter(Boolean));
  if(mode==='home'){
    const result=new Set();
    const regions=candidates.filter(item=>item.onScreen&&item.hierarchyLevel===1)
      .sort((a,b)=>b.depth-a.depth).slice(0,homeLimit);
    for(const item of regions)result.add(item.id);
    for(const item of candidates)if(item.onScreen&&(item.kind==='root'||interactions.has(item.id)))result.add(item.id);
    return result;
  }
  return selectFrontLabelIds(candidates.map(item=>interactions.has(item.id)?{...item,forced:true,forcePriority:item.id===selectedId?100:item.id===hoveredId?90:70}:item),{limit,minDepth,forcedLimit});
}

export function depthLabelStyle({depth=0,perspective=1,kind='component',active=false,hover=0}){
  const importance={root:9,architecture_dimension:5,architecture_chain:2,topic:4,platform:3,domain:3,subtopic:2}[kind]||0;
  const depthLevel=Math.max(0,Math.min(1,(depth+560)/1120));
  const base=kind==='root'?16:kind==='architecture_dimension'?12:kind==='topic'?12:kind==='platform'||kind==='domain'?10.5:8;
  return{
    visible:true,
    size:Math.max(7,Math.min(22,base*perspective+depthLevel*2.2+hover*5+(active?3:0))),
    alpha:active?1:Math.max(.2,Math.min(.95,.2+depthLevel*.48+importance*.035+hover*.2)),
    weight:kind==='root'||kind==='architecture_dimension'||kind==='topic'||kind==='platform'||kind==='domain'?650:500,
  };
}

export function orbitPose(pose,time,delta){
  return{
    yaw:pose.yaw+delta*.00011,
    pitch:-.16+Math.sin(time*.00016)*.105,
    roll:Math.sin(time*.000105)*.042,
  };
}

export function drillVisibleNodeIds(graph,{selectedId=null,expandedDepth=1,evidenceVisible=false,technicalNeighborLimit=8,matchingIds=[]}={}){
  const byId=new Map(graph.nodes.map(node=>[node.id,node])),visible=new Set(['root']),matches=new Set(matchingIds||[]);
  if(!selectedId){for(const id of homeVisibleNodeIds(graph))visible.add(id);for(const id of matches)visible.add(id);return visible;}
  let cursor=byId.get(selectedId),guard=new Set();
  while(cursor&&!guard.has(cursor.id)){visible.add(cursor.id);guard.add(cursor.id);cursor=cursor.primaryParentId?byId.get(cursor.primaryParentId):undefined;}
  let frontier=[selectedId];
  for(let depth=0;depth<Math.max(0,expandedDepth);depth++){
    const next=[];
    for(const parentId of frontier)for(const node of graph.nodes)if(node.primaryParentId===parentId&&!node.navigationOnly&&!['source','evidence','lesson','review','chapter','topic'].includes(node.kind)){visible.add(node.id);next.push(node.id);}
    frontier=next;
  }
  const neighbors=[];
  for(const edge of graph.edges){
    if(edge.from!==selectedId&&edge.to!==selectedId)continue;
    const other=edge.from===selectedId?edge.to:edge.from,node=byId.get(other);if(!node)continue;
    if(edge.type==='supported_by'||node.kind==='source'||node.kind==='evidence'){
      if(evidenceVisible)visible.add(other);
      continue;
    }
    if(edge.layer==='hierarchy'||edge.pathClass==='hierarchy'||edge.pathClass==='index')continue;
    neighbors.push({id:other,priority:edge.pathClass==='data'?4:edge.pathClass==='control'?3:edge.pathClass==='power'?2:1});
  }
  neighbors.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
  for(const item of neighbors.slice(0,Math.max(0,technicalNeighborLimit)))visible.add(item.id);
  if(evidenceVisible){
    const evidenceScope=new Set([selectedId]);
    for(const edge of graph.edges){
      if(edge.from!==selectedId&&edge.to!==selectedId)continue;
      if(edge.type==='supported_by')evidenceScope.add(edge.from===selectedId?edge.to:edge.from);
      for(const claim of edge.claims||[])for(const evidenceId of claim.evidenceIds||[])evidenceScope.add(evidenceId);
    }
    let changed=true;
    while(changed){changed=false;for(const edge of graph.edges)if(edge.type==='supported_by'){
      if(evidenceScope.has(edge.from)&&!evidenceScope.has(edge.to)){evidenceScope.add(edge.to);changed=true;}
    }}
    for(const id of evidenceScope){const node=byId.get(id);if(id===selectedId||node?.kind==='source'||node?.kind==='evidence')visible.add(id);}
  }
  for(const id of matches)visible.add(id);
  return visible;
}
