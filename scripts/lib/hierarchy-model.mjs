import {readFile} from 'node:fs/promises';

export async function loadHierarchy(filePath){
  return JSON.parse(await readFile(filePath,'utf8'));
}

export async function loadArchitectureTaxonomy(filePath){
  return JSON.parse(await readFile(filePath,'utf8'));
}

export function applyArchitectureTaxonomy(inputNodes,definition){
  const merged=inputNodes.map(node=>({...node}));
  const byId=new Map(merged.map(node=>[node.id,node]));
  const rootDefinition=definition.root||{id:'root',title:'智能座舱'};
  const root=byId.get(rootDefinition.id);
  if(root)Object.assign(root,rootDefinition,{kind:'root',hierarchyLevel:0,hierarchyOrder:0,branchType:'root',navigationOnly:false});
  else{
    const node={...rootDefinition,kind:'root',hierarchyLevel:0,hierarchyOrder:0,branchType:'root',navigationOnly:false};
    merged.push(node);byId.set(node.id,node);
  }
  for(const dimension of definition.dimensions||[]){
    const value={layer:'hierarchy',...dimension,kind:'architecture_dimension',primaryParentId:rootDefinition.id,hierarchyLevel:1,
      hierarchyOrder:dimension.order??0,branchType:'architecture-dimension',navigationOnly:false};
    const existing=byId.get(value.id);
    if(existing)Object.assign(existing,value);
    else{merged.push(value);byId.set(value.id,value);}
  }
  for(const chain of definition.chains||[]){
    const value={layer:'hierarchy',...chain,kind:'architecture_chain',hierarchyLevel:2,hierarchyOrder:chain.order??0,
      secondaryParentIds:[...(chain.secondaryParentIds||[])],branchType:'architecture-chain',navigationOnly:false};
    const existing=byId.get(value.id);
    if(existing)Object.assign(existing,value);
    else{merged.push(value);byId.set(value.id,value);}
  }
  return merged;
}

export function validateSecondaryParents(nodes,{allowedParentLevel=1}={}){
  const issues=[];
  const byId=new Map(nodes.map(node=>[node.id,node]));
  for(const node of nodes){
    const parents=node.secondaryParentIds||[];
    const seen=new Set();
    for(const parentId of parents){
      if(parentId===node.id)issues.push(`self membership: ${node.id}`);
      if(seen.has(parentId))issues.push(`duplicate secondary parent: ${node.id} -> ${parentId}`);
      seen.add(parentId);
      if(parentId===node.primaryParentId)issues.push(`secondary parent repeats primary parent: ${node.id} -> ${parentId}`);
      const parent=byId.get(parentId);
      if(!parent)issues.push(`missing secondary parent: ${node.id} -> ${parentId}`);
      else if(parent.hierarchyLevel!==allowedParentLevel)issues.push(`secondary parent must be level ${allowedParentLevel}: ${node.id} -> ${parentId}`);
    }
  }
  return [...new Set(issues)];
}

export function buildSecondaryHierarchyEdges(nodes){
  return nodes.flatMap(node=>(node.secondaryParentIds||[]).map(parentId=>({
    id:`hierarchy-secondary:${parentId}:${node.id}`,
    from:parentId,to:node.id,type:'secondary_contains',pathClass:'hierarchy-secondary',layer:'hierarchy',navigationOnly:true
  })));
}

function inferredParent(node,definition,ids){
  const assigned=definition.assignments?.[node.id];
  if(assigned)return assigned;
  if(node.kind==='chapter'||node.kind==='lesson'||node.kind==='review')return 'chain:system-overview';
  if(node.kind==='source')return ({
    platform:'chain:platform-family',virtualization:'chain:runtime-boundaries',android:'chain:android-app-framework',
    yocto:'chain:hal-driver-boundary',mcu:'chain:mcu-soc-responsibility',tbox:'chain:tbox-connectivity',
    display:'chain:display-output',camera:'chain:avm-video-flow',audio:'chain:audio-paths',power:'chain:power-lifecycle',
    boot:'chain:boot-lifecycle',stability:'chain:stability',diagnosis:'chain:evidence-ledger',usb:'chain:usb-storage',security:'chain:tee-security'
  })[node.category]||'chain:evidence-ledger';
  if(node.kind==='evidence')return node.sourceId;
  if(node.id?.startsWith('subtopic:raw:'))return 'chain:evidence-ledger';
  if(node.id?.startsWith('subtopic:power:')){
    if(node.parentId?.startsWith('subtopic:power:'))return node.parentId;
    return 'domain:power';
  }
  if(['platform','component','interface','state','process','observation','failure_mode'].includes(node.kind)){
    const domainId=node.domain==='usb'?'domain:usb-storage':`domain:${node.domain}`;
    if(ids.has(domainId))return domainId;
  }
  return undefined;
}

export function applyHierarchy(inputNodes,definition){
  const merged=inputNodes.map(node=>({...node}));
  const ids=new Set(merged.map(node=>node.id));
  for(const node of definition.nodes||[]){
    if(ids.has(node.id))continue;
    merged.push({layer:'hierarchy',...node});ids.add(node.id);
  }
  for(const node of merged){
    if(node.id===definition.rootId||node.id==='root'){
      delete node.primaryParentId;
      node.hierarchyLevel=0;
      node.hierarchyOrder=node.hierarchyOrder??0;
      node.branchType=node.branchType||'root';
      node.navigationOnly=false;
      continue;
    }
    const explicit=node.primaryParentId;
    node.primaryParentId=explicit||inferredParent(node,definition,ids);
    node.hierarchyOrder=node.hierarchyOrder??0;
    node.branchType=node.branchType||node.kind||'knowledge';
    node.navigationOnly=node.navigationOnly??['topic','subtopic','chapter','lesson','review','index','source','evidence'].includes(node.kind);
    if(['topic','chapter','lesson','review','source','evidence'].includes(node.kind)||node.id?.startsWith('subtopic:raw:'))node.hiddenByDefault=true;
  }
  const byId=new Map(merged.map(node=>[node.id,node]));
  const levels=new Map([['root',0]]);
  const levelOf=(id,trail=new Set())=>{
    if(levels.has(id))return levels.get(id);
    if(trail.has(id))return undefined;
    const node=byId.get(id);if(!node?.primaryParentId)return undefined;
    trail.add(id);const parentLevel=levelOf(node.primaryParentId,trail);trail.delete(id);
    if(parentLevel===undefined)return undefined;
    const level=parentLevel+1;levels.set(id,level);return level;
  };
  for(const node of merged){
    const level=levelOf(node.id);
    if(level!==undefined)node.hierarchyLevel=level;
  }
  return merged;
}

export function validateHierarchy(nodes,{rootId='root'}={}){
  const issues=[];
  const counts=new Map();
  for(const node of nodes)counts.set(node.id,(counts.get(node.id)||0)+1);
  for(const [id,count] of counts)if(count>1)issues.push(`multiple assignment: duplicate node ${id}`);
  const byId=new Map(nodes.map(node=>[node.id,node]));
  if(!byId.has(rootId))issues.push(`missing root: ${rootId}`);
  for(const node of nodes){
    if(node.id===rootId){
      if(node.primaryParentId)issues.push(`multiple assignment: root ${rootId} has a parent`);
      if(node.hierarchyLevel!==0)issues.push(`level gap: root ${rootId} must be level 0`);
      continue;
    }
    if(Array.isArray(node.primaryParentId)||!node.primaryParentId){
      issues.push(`multiple assignment: ${node.id} must have exactly one primary parent`);
      issues.push(`unreachable: ${node.id}`);
      continue;
    }
    const parent=byId.get(node.primaryParentId);
    if(!parent){issues.push(`missing parent: ${node.id} -> ${node.primaryParentId}`);issues.push(`unreachable: ${node.id}`);continue;}
    if(Number.isInteger(node.hierarchyLevel)&&Number.isInteger(parent.hierarchyLevel)&&node.hierarchyLevel!==parent.hierarchyLevel+1){
      issues.push(`level gap: ${parent.id}(${parent.hierarchyLevel}) -> ${node.id}(${node.hierarchyLevel})`);
    }
  }
  for(const node of nodes){
    if(node.id===rootId)continue;
    const seen=new Set();let cursor=node;
    while(cursor&&cursor.id!==rootId){
      if(seen.has(cursor.id)){issues.push(`cycle: ${[...seen,cursor.id].join(' -> ')}`);break;}
      seen.add(cursor.id);cursor=byId.get(cursor.primaryParentId);
    }
    if(!cursor&&!issues.some(issue=>issue===`unreachable: ${node.id}`))issues.push(`unreachable: ${node.id}`);
  }
  return [...new Set(issues)];
}

export function buildHierarchyEdges(nodes){
  return nodes.filter(node=>node.primaryParentId).map(node=>({
    id:`hierarchy:${node.primaryParentId}:${node.id}`,
    from:node.primaryParentId,to:node.id,type:'primary_contains',pathClass:'hierarchy',layer:'hierarchy',
    navigationOnly:Boolean(node.navigationOnly)
  }));
}

export function breadcrumbIds(nodes,nodeId){
  const byId=new Map(nodes.map(node=>[node.id,node]));
  const path=[];const seen=new Set();let cursor=byId.get(nodeId);
  while(cursor&&!seen.has(cursor.id)){
    path.push(cursor.id);seen.add(cursor.id);cursor=cursor.primaryParentId?byId.get(cursor.primaryParentId):undefined;
  }
  return path.reverse();
}
