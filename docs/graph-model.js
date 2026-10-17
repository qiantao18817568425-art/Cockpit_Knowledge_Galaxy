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
    if(edge.type!=='supported_by'&&(edge.from===nodeId||edge.to===nodeId))for(const claim of edge.claims||[])for(const evidenceId of claim.evidenceIds||[])found.add(evidenceId);
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

const relationLabels={
  controls:'控制',depends_on:'依赖',observed_by:'由观测点确认',transitions_to:'状态流转',fails_as:'失效表现',
  supported_by:'由资料支持',contains:'包含',runs_on:'运行于',connects_to:'连接',implements:'实现',maps_to:'映射到',
  '主题目录':'主题目录','主题归类':'主题归类','主题细分':'主题细分','课程覆盖':'课程覆盖','课程顺序':'课程顺序'
};
const pathLabels={control:'控制路径',data:'数据路径',power:'电源路径',diagnostic:'诊断与证据路径',index:'知识索引'};

function evidenceItem(node,status,relation){
  return {
    id:node.id,
    kind:node.kind,
    status:status||node.status||node.processingState||'reference',
    sourceName:node.sourceName||node.title||'原始资料',
    pages:node.pages||[],
    url:node.downloadUrl||node.url,
    summary:node.summary||node.description||'已收录的原始资料，可在线加载或下载后结合对应车型与版本核对。',
    relationType:relation?.type||'supported_by'
  };
}

export function buildReaderModel(graph,nodeId,{maxRelations=12,maxCitations=12,maxDepth=2}={}){
  const byId=new Map(graph.nodes.map(node=>[node.id,node]));
  const node=byId.get(nodeId);if(!node)return null;
  const relationPriority=edge=>{
    const other=byId.get(edge.from===nodeId?edge.to:edge.from),kind=other?.kind;
    if(edge.type==='主题细分')return 0;
    if(edge.pathClass&&edge.pathClass!=='index')return 1;
    if(kind==='subtopic')return 2;
    if(['platform','domain','component','interface','state','process','observation','failure_mode'].includes(kind))return 3;
    if(kind==='chapter')return 5;if(kind==='lesson')return 6;if(kind==='review')return 7;if(kind==='root')return 9;return 4;
  };
  const direct=graph.edges.filter(edge=>edge.from===nodeId||edge.to===nodeId).sort((a,b)=>relationPriority(a)-relationPriority(b));
  const insights=[];
  for(const edge of direct){
    const other=byId.get(edge.from===nodeId?edge.to:edge.from);
    if(!other||other.kind==='evidence'||other.kind==='source')continue;
    const outgoing=edge.from===nodeId;
    const relation=relationLabels[edge.type]||edge.type||'关联';
    const path=pathLabels[edge.pathClass]||'知识关系';
    const text=outgoing
      ? `「${node.title}」通过“${relation}”关联到「${other.title}」。${other.description||''}`
      : `「${other.title}」通过“${relation}”关联到「${node.title}」。${other.description||''}`;
    insights.push({id:`${edge.from}:${edge.to}:${edge.type}`,basis:'graph_relation',pathClass:edge.pathClass||'index',pathLabel:path,relationType:edge.type,text:text.trim(),relatedId:other.id,relatedTitle:other.title});
    if(insights.length>=maxRelations)break;
  }

  const citationByKey=new Map(),visited=new Set([nodeId]),queue=[{id:nodeId,depth:0}];
  const addCitation=(item)=>{
    const key=`${item.sourceName}:${JSON.stringify(item.pages)}:${item.status}`,existing=citationByKey.get(key);
    if(existing){if(item.summary&&!existing.summary.includes(item.summary))existing.summary=`${existing.summary}${existing.summary?'；':''}${item.summary}`;return}
    citationByKey.set(key,item);
  };
  while(queue.length){
    const current=queue.shift();
    for(const edge of graph.edges){
      if(edge.from!==current.id&&edge.to!==current.id)continue;
      for(const claim of edge.claims||[])for(const evidenceId of claim.evidenceIds||[]){const evidence=byId.get(evidenceId);if(evidence)addCitation(evidenceItem(evidence,claim.status,edge))}
      const otherId=edge.from===current.id?edge.to:edge.from,other=byId.get(otherId);
      if(!other)continue;
      if(other.kind==='evidence'||other.kind==='source')addCitation(evidenceItem(other,edge.status,edge));
      if(current.depth<maxDepth&&!visited.has(otherId)&&other.kind!=='evidence'&&other.kind!=='source'){
        visited.add(otherId);queue.push({id:otherId,depth:current.depth+1});
      }
    }
  }
  const citationPriority=item=>{
    const hasPages=(item.pages?.flat?.(Infinity)||item.pages||[]).length>0;
    const isEvidence=item.kind==='evidence';
    const isIndexed=['indexed','container_indexed','source_register','reference'].includes(item.status);
    return (hasPages?0:4)+(isEvidence?0:2)+(isIndexed?1:0);
  };
  const citations=[...citationByKey.values()].sort((a,b)=>citationPriority(a)-citationPriority(b)).slice(0,maxCitations);
  const references=[];
  if(node.url)references.push({
    id:`article:${node.id}`,kind:'article',title:`${node.title} · 学习文章`,url:node.url,pages:node.pages||[],
    status:'published_article',summary:`围绕「${node.title}」整理的公开学习文章，章节定位以链接锚点为准。`
  });
  if(node.downloadUrl)references.push({
    id:`source:${node.id}`,kind:'source',title:node.sourceName||node.title,url:node.downloadUrl,pages:node.pages||[],
    status:node.status||node.processingState||'source_register',
    summary:node.summary||node.description||'已收录的原始资料，可在线加载或下载后结合对应车型与版本核对。'
  });
  for(const citation of citations)if(citation.url)references.push({
    id:`source:${citation.id}`,kind:'source',title:citation.sourceName,url:citation.url,pages:citation.pages,
    status:citation.status,summary:citation.summary
  });
  const uniqueReferences=[...new Map(references.map(item=>[item.url,item])).values()];
  let summary=node.summary||node.description||`本专题整理「${node.title}」在座舱知识图谱中的职责、边界与关联。`;
  let summaryBasis=node.summary?'curated_summary':node.description?'curated_description':'generated_outline';
  if(['topic','domain','platform'].includes(node.kind)){
    const branches=direct.map(edge=>byId.get(edge.from===nodeId?edge.to:edge.from)).filter(item=>item?.description&&['subtopic','component','interface','state','process','observation','failure_mode'].includes(item.kind)).slice(0,5);
    if(branches.length){summary=`${summary.replace(/[。；]$/,'')}。结合已整理的知识关系，本专题重点覆盖：${branches.map(item=>`${item.title}（${item.description}）`).join('；')}。`;summaryBasis='graph_synthesis'}
  }
  return {
    id:node.id,title:node.title,kind:node.kind,
    summary,summaryBasis,
    scope:{platforms:node.platforms||[],runtimeDomain:node.runtimeDomain||node.domain,version:node.version,status:node.status},
    insights,citations,references:uniqueReferences,
    notice:'衍生内容来自知识图谱关系，用于扩展阅读与排查方向；车型、版本、接口编号及时序仍以引用原文和现车资料为准。'
  };
}

function pageText(pages=[]){const flat=pages.flat?.(Infinity)||pages;return flat.length?`第 ${flat.join('、')} 页`:'页码未标注'}

export function readerMarkdown(model){
  if(!model)return'';
  const scope=[...(model.scope.platforms||[]),model.scope.runtimeDomain,model.scope.version].filter(Boolean).join(' · ')||'未限定';
  const basis={curated_summary:'人工整理摘要',curated_description:'知识图谱整理说明',graph_synthesis:'知识图谱综合整理',generated_outline:'图谱结构生成提纲'}[model.summaryBasis]||'知识整理';
  const lines=[`# ${model.title}`,'',`> 专题总结依据：${basis}`,'',model.summary,'',`**适用范围：** ${scope}`,'','## 图谱关系衍生',''];
  if(model.insights.length)for(const item of model.insights)lines.push(`- **${item.pathLabel}**：${item.text}`);else lines.push('- 当前节点暂无可展开的知识关系。');
  lines.push('','> '+model.notice,'','## 引用资料与文章','');
  if(model.citations.length)for(const item of model.citations){lines.push(`- **${item.sourceName}**（${pageText(item.pages)}，${item.status}）${item.summary?`：${item.summary}`:''}${item.url?`  \n  ${item.url}`:''}`)}else lines.push('- 当前节点暂无已绑定的页码证据。');
  for(const item of model.references.filter(item=>item.kind==='article'))lines.push(`- **学习文章：${item.title}**（${pageText(item.pages)}，${item.status||'published_article'}）${item.summary?`：${item.summary}`:''}  \n  ${item.url}`);
  lines.push('','---','','生成自座舱知识银河。引用内容应结合对应车型、软件版本和原始资料复核。','');
  return lines.join('\n');
}

