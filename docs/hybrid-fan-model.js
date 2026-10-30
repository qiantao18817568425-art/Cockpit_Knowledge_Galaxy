function sorted(nodes){return [...nodes].sort((a,b)=>(a.hierarchyOrder??999999)-(b.hierarchyOrder??999999)||a.id.localeCompare(b.id))}
export function buildFanModel(graph,{dimensionId,focusedNodeId=null,expandedGroupIds=new Set(),maxCurves=24,relationMode='hierarchy',pathClasses=[],platforms=[]}={}){
  const nodes=graph.nodes||[];const direct=id=>sorted(nodes.filter(node=>node.primaryParentId===id));
  const row=node=>({nodeId:node.id,title:node.title,description:node.description||'',level:node.hierarchyLevel??3,parentId:node.primaryParentId});
  const members=sorted(nodes.filter(node=>node.primaryParentId===dimensionId||node.secondaryParentIds?.includes(dimensionId)));
  const groups=members.map(node=>{
    const children=direct(node.id).map(child=>({nodeId:child.id,title:child.title,description:child.description||'',level:child.hierarchyLevel??3,parentId:node.id}));
    return{nodeId:node.id,title:node.title,children,secondary:node.primaryParentId!==dimensionId,empty:children.length===0,expanded:expandedGroupIds.has(node.id)};
  });
  let rows,collapsedGroups=[];
  if(focusedNodeId){
    const children=direct(focusedNodeId);rows=[];
    const mainIds=new Set();let main=children[0];while(main){mainIds.add(main.id);main=direct(main.id)[0]}
    for(const child of children){
      rows.push(row(child));const descendants=[];const queue=[...direct(child.id)];while(queue.length){const item=queue.shift();descendants.push(item);queue.push(...direct(item.id))}
      const rest=descendants.filter(item=>!mainIds.has(item.id));const id=`deep:${focusedNodeId}:${child.id}`;
      if(rest.length)collapsedGroups.push({id,title:child.title,nodeIds:rest.map(item=>item.id),expanded:expandedGroupIds.has(id)});
      for(const item of descendants)if(mainIds.has(item.id)||expandedGroupIds.has(id))rows.push(row(item));
    }
  }else rows=groups.flatMap(group=>[{nodeId:group.nodeId,title:group.title,level:2,isGroup:true,description:group.secondary?'跨维度关联 · 同一知识节点':'三级知识链'},...group.children]);
  if(platforms.length)rows=rows.filter(item=>{const node=nodes.find(n=>n.id===item.nodeId),supported=node?.platforms||node?.scope?.platforms||[];return !supported.length||supported.some(value=>platforms.includes(value))});
  const visibleIds=new Set(rows.map(item=>item.nodeId));
  const classes=new Set(['control','data','power','state','diagnostic']);
  const technicalEdges=relationMode==='technical'?(graph.edges||[]).filter(edge=>classes.has(edge.pathClass)&&(!pathClasses.length||pathClasses.includes(edge.pathClass))&&visibleIds.has(edge.from)&&visibleIds.has(edge.to)&&(!platforms.length||!edge.platforms?.length||edge.platforms.some(value=>platforms.includes(value)))):[];
  return{groups,rows,collapsedGroups,technicalEdges,relationMode,visibleCurves:rows.slice(0,Math.max(0,maxCurves)),totalRowCount:rows.length};
}
