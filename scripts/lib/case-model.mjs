export function embedCases(nodes,architectureTaxonomy,caseRegister,{reset=true}={}){
  const byId=new Map(nodes.map(node=>[node.id,node]));
  if(reset)for(const node of nodes){delete node.cases;delete node.caseIds}
  const parentIds=new Map((architectureTaxonomy.chains||[]).map(chain=>[
    chain.id,[chain.primaryParentId,...(chain.secondaryParentIds||[])].filter(Boolean)
  ]));
  const attach=(node,view)=>{
    if(!node)return;
    node.cases=node.cases||[];
    node.caseIds=[...new Set([...(node.caseIds||[]),view.id])];
    const key=`${view.id}:${view.projectionKnowledgeId||view.mappedNodeId||''}`;
    if(!node.cases.some(current=>`${current.id}:${current.projectionKnowledgeId||current.mappedNodeId||''}`===key))node.cases.push(view);
  };
  for(const item of caseRegister.cases||[]){
    const projections=item.projections?.length?item.projections:(item.knowledgeIds||[]).map(knowledgeId=>({knowledgeId,summary:item.publicSummary}));
    for(const projection of projections){
      const view={...item,projectionKnowledgeId:projection.knowledgeId,projection:{...projection}};
      delete view.projections;
      attach(byId.get(projection.knowledgeId),view);
      for(const parentId of parentIds.get(projection.knowledgeId)||[])attach(byId.get(parentId),{...view,mappedNodeId:parentId});
    }
  }
  return nodes;
}
