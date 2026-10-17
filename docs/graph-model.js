const candidateStatuses=new Set(['inferred_mapping','conflicting','needs_visual_review']);

function text(node){return [node.title,node.description,...(node.aliases||[])].filter(Boolean).join(' ').toLocaleLowerCase()}

export function rankSearchResults(nodes,query,filters={}){
  const q=query.trim().toLocaleLowerCase(); if(!q)return [];
  const platforms=new Set(filters.platforms||[]);
  return nodes.filter(node=>{
    if(platforms.size&&!(node.platforms||[]).some(x=>platforms.has(x)))return false;
    return text(node).includes(q);
  }).sort((a,b)=>{
    const at=a.title.toLocaleLowerCase(),bt=b.title.toLocaleLowerCase();
    return Number(bt===q)-Number(at===q)||Number(bt.startsWith(q))-Number(at.startsWith(q))||a.title.localeCompare(b.title,'zh-CN');
  });
}

export function expandEvidenceNeighborhood(graph,nodeId){
  const found=new Set([nodeId]);
  for(const edge of graph.edges){
    if(edge.from===nodeId&&edge.type==='supported_by')found.add(edge.to);
    if(edge.to===nodeId&&edge.type==='supported_by')found.add(edge.from);
  }
  let changed=true;
  while(changed){changed=false;for(const edge of graph.edges){if(edge.type!=='supported_by')continue;if(found.has(edge.from)&&!found.has(edge.to)){found.add(edge.to);changed=true}}}
  return found;
}

export function visibleNodeIds(graph,state={}){
  const platforms=new Set(state.platforms||[]), paths=new Set(state.pathClasses||[]);
  const evidence=state.evidenceVisible&&state.selectedId?expandEvidenceNeighborhood(graph,state.selectedId):new Set();
  const connectedByPath=new Set();
  if(paths.size)for(const edge of graph.edges)if(!edge.pathClass||paths.has(edge.pathClass)){connectedByPath.add(edge.from);connectedByPath.add(edge.to)}
  return new Set(graph.nodes.filter(node=>{
    if(node.kind==='source'||node.kind==='evidence')return evidence.has(node.id);
    if(!state.candidateVisible&&candidateStatuses.has(node.status))return false;
    if(platforms.size&&node.layer==='knowledge'&&(node.platforms||[]).length&&!(node.platforms||[]).some(x=>platforms.has(x)))return false;
    if(paths.size&&node.layer==='knowledge'&&!connectedByPath.has(node.id))return false;
    return true;
  }).map(node=>node.id));
}

export function detailModel(graph,nodeId){
  const node=graph.nodes.find(x=>x.id===nodeId); if(!node)return null;
  const relations=graph.edges.filter(x=>x.from===nodeId||x.to===nodeId);
  const evidence=[];
  for(const relation of relations){
    for(const claim of relation.claims||[]){
      for(const evidenceId of claim.evidenceIds||[]){
        const item=graph.nodes.find(x=>x.id===evidenceId); if(item)evidence.push({status:claim.status,sourceName:item.sourceName,pages:item.pages,url:item.downloadUrl,summary:item.summary});
      }
    }
  }
  if(node.kind==='evidence')evidence.push({status:node.status,sourceName:node.sourceName,pages:node.pages,url:node.downloadUrl,summary:node.summary});
  return {id:node.id,title:node.title,kind:node.kind,description:node.description||node.summary||'',runtimeDomain:node.runtimeDomain||node.domain,
    platforms:node.platforms||[],version:node.version,status:node.status,relations,evidence:[...new Map(evidence.map(x=>[`${x.sourceName}:${JSON.stringify(x.pages)}:${x.summary}`,x])).values()]};
}

