const GOLDEN_ANGLE=Math.PI*(3-Math.sqrt(5));

export function fibonacciSpherePoint(index,total,radius=1){
  const count=Math.max(1,total);
  const y=1-(index+.5)*2/count;
  const ring=Math.sqrt(Math.max(0,1-y*y));
  const angle=index*GOLDEN_ANGLE;
  return{x:Math.cos(angle)*ring*radius,y:y*radius,z:Math.sin(angle)*ring*radius};
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

export function depthLabelStyle({depth=0,perspective=1,kind='component',active=false,hover=0}){
  const importance={root:9,topic:4,platform:3,domain:3,subtopic:2}[kind]||0;
  const depthLevel=Math.max(0,Math.min(1,(depth+560)/1120));
  const base=kind==='root'?17:kind==='topic'?12:kind==='platform'||kind==='domain'?10.5:8;
  return{
    visible:true,
    size:Math.max(7,Math.min(22,base*perspective+depthLevel*2.2+hover*5+(active?3:0))),
    alpha:active?1:Math.max(.2,Math.min(.95,.2+depthLevel*.48+importance*.035+hover*.2)),
    weight:kind==='root'||kind==='topic'||kind==='platform'||kind==='domain'?650:500,
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
  if(!selectedId){for(const node of graph.nodes)if(node.primaryParentId==='root'&&node.hierarchyLevel===1)visible.add(node.id);for(const id of matches)visible.add(id);return visible;}
  let cursor=byId.get(selectedId),guard=new Set();
  while(cursor&&!guard.has(cursor.id)){visible.add(cursor.id);guard.add(cursor.id);cursor=cursor.primaryParentId?byId.get(cursor.primaryParentId):undefined;}
  let frontier=[selectedId];
  for(let depth=0;depth<Math.max(0,expandedDepth);depth++){
    const next=[];
    for(const parentId of frontier)for(const node of graph.nodes)if(node.primaryParentId===parentId){visible.add(node.id);next.push(node.id);}
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
