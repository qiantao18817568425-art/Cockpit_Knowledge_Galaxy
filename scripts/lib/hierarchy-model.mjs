import {readFile} from 'node:fs/promises';

export async function loadHierarchy(filePath){
  return JSON.parse(await readFile(filePath,'utf8'));
}

function inferredParent(node,definition,ids){
  const assigned=definition.assignments?.[node.id];
  if(assigned)return assigned;
  if(node.kind==='chapter')return 'pyramid:course:chapters';
  if(node.kind==='lesson')return 'pyramid:course:lessons';
  if(node.kind==='review')return 'pyramid:course:reviews';
  if(node.kind==='source')return `subtopic:raw:${node.category}`;
  if(node.kind==='evidence')return node.sourceId;
  if(node.id?.startsWith('subtopic:raw:'))return 'topic:raw';
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
    node.navigationOnly=node.navigationOnly??['topic','subtopic','chapter','lesson','review','index'].includes(node.kind);
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
