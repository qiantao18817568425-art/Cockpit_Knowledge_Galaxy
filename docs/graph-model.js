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
    const aq=Number(Boolean(a.knowledge?.role)||a.contentState==='absorbed')-Number(Boolean(a.navigationOnly));
    const bq=Number(Boolean(b.knowledge?.role)||b.contentState==='absorbed')-Number(Boolean(b.navigationOnly));
    return Number(bt===q)-Number(at===q)||bq-aq||Number(bt.startsWith(q))-Number(at.startsWith(q))||a.title.localeCompare(b.title,'zh-CN');
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
  carries_data_to:'传递数据',sends_to:'发送到',variant_of:'平台变体',publishes:'发布',conflicts_with:'存在版本冲突',powers:'供电',belongs_to:'资料归类',
  provides_input_to:'提供输入',uses:'使用',hosts:'承载运行',requires:'需要',crosses_boundary:'跨越边界',constrains:'约束',verifies:'验证',can_amplify:'可能放大',restores:'恢复',enables:'使能',
  '主题目录':'主题目录','主题归类':'主题归类','主题细分':'主题细分','内容索引':'内容索引','课程覆盖':'课程覆盖','课程顺序':'课程顺序'
};
const pathLabels={control:'控制路径',data:'数据路径',power:'电源路径',diagnostic:'诊断与证据路径',index:'知识索引'};
const navigationRelations=new Set(['主题目录','主题归类','主题细分','内容索引','课程覆盖','课程顺序','belongs_to']);
const technicalRelationTypes=new Set(['controls','depends_on','observed_by','transitions_to','fails_as','runs_on','carries_data_to','sends_to','publishes','subscribes','powers','variant_of','conflicts_with','supersedes','implements','provides_input_to','uses','hosts','requires','crosses_boundary','constrains','verifies','can_amplify','restores','enables']);

export function buildHierarchyIndex(graph){
  const byId=new Map(graph.nodes.map(node=>[node.id,node]));
  const children=new Map(graph.nodes.map(node=>[node.id,[]]));
  for(const node of graph.nodes)if(node.primaryParentId&&children.has(node.primaryParentId))children.get(node.primaryParentId).push(node);
  for(const items of children.values())items.sort((a,b)=>(a.hierarchyOrder??0)-(b.hierarchyOrder??0)||a.title.localeCompare(b.title,'zh-CN'));
  return {byId,children};
}

export function buildBreadcrumb(graph,nodeId){
  const {byId}=buildHierarchyIndex(graph),result=[],seen=new Set();let node=byId.get(nodeId);
  while(node&&!seen.has(node.id)){result.push(node);seen.add(node.id);node=node.primaryParentId?byId.get(node.primaryParentId):undefined;}
  return result.reverse();
}

export function directChildren(graph,nodeId){
  return buildHierarchyIndex(graph).children.get(nodeId)||[];
}

export function buildMembershipModel(graph,nodeId){
  const byId=new Map(graph.nodes.map(node=>[node.id,node])),node=byId.get(nodeId);
  if(!node)return{primary:null,secondary:[],breadcrumb:[]};
  const compact=item=>item?({id:item.id,title:item.title,level:item.hierarchyLevel,branchType:item.branchType}):null;
  const secondary=(node.secondaryParentIds||[]).map(id=>byId.get(id)).filter(Boolean)
    .sort((a,b)=>(a.hierarchyOrder??0)-(b.hierarchyOrder??0)||a.title.localeCompare(b.title,'zh-CN')).map(compact);
  return{primary:compact(byId.get(node.primaryParentId)),secondary,breadcrumb:buildBreadcrumb(graph,nodeId).map(compact)};
}

function claimsForPlatforms(claims,platforms=[]){
  const selected=new Set(platforms);
  if(!selected.size)return claims||[];
  return (claims||[]).filter(claim=>!(claim.platforms||[]).length||(claim.platforms||[]).some(platform=>selected.has(platform)));
}

export function groupTechnicalRelations(graph,nodeId,{platforms=[]}={}){
  const byId=new Map(graph.nodes.map(node=>[node.id,node])),selected=byId.get(nodeId),groups={};
  const awaiting=selected?.contentState==='awaiting_absorption'||!selected?.knowledge?.role;
  for(const edge of graph.edges){
    if(edge.from!==nodeId&&edge.to!==nodeId)continue;
    if(!technicalRelationTypes.has(edge.type)||navigationRelations.has(edge.type)||edge.layer==='hierarchy')continue;
    if(platforms.length&&(edge.platforms||[]).length&&!(edge.platforms||[]).some(platform=>platforms.includes(platform)))continue;
    if(awaiting&&!edge.why)continue;
    const relatedId=edge.from===nodeId?edge.to:edge.from,related=byId.get(relatedId);if(!related)continue;
    const key=edge.pathClass==='control'&&edge.type==='transitions_to'?'state':edge.pathClass||'state';
    (groups[key]||=[]).push({
      id:edge.id||`${edge.from}:${edge.to}:${edge.type}`,
      fromId:edge.from,toId:edge.to,relatedId,relatedTitle:related.title,
      direction:edge.from===nodeId?'outgoing':'incoming',relationType:edge.type,
      pathClass:key,pathLabel:pathLabels[key]||'状态路径',
      why:edge.why||relationRationale(edge,byId),input:edge.input||'',handoff:edge.handoff||'',output:edge.output||'',
      verification:edge.verification||[],status:edge.status,claims:claimsForPlatforms(edge.claims,platforms)
    });
  }
  return groups;
}

function relationLabel(edge,byId){
  const from=byId.get(edge.from),to=byId.get(edge.to);
  if(edge.type==='belongs_to')return from?.kind==='source'?'资料归属':'分类归属';
  if(edge.type==='fails_as'&&from?.kind==='failure_mode'&&to?.kind==='state')return '故障后恢复/重建';
  return relationLabels[edge.type]||edge.type||'关联';
}

function relationTitle(edge,byId){
  const from=byId.get(edge.from),to=byId.get(edge.to),relation=relationLabel(edge,byId);
  return `「${from?.title||edge.from}」→「${to?.title||edge.to}」（${relation}）`;
}

function relationRationale(edge,byId){
  const fromNode=byId.get(edge.from),toNode=byId.get(edge.to);
  const from=fromNode?.title||edge.from,to=toNode?.title||edge.to;
  if(edge.type==='belongs_to'){
    if(fromNode?.kind==='source')return `「${from}」是原始资料，图谱将它归入「${to}」知识域，表示该资料的主要阅读与检索范围；这不代表资料中的每项内容都适用于当前车型或版本。`;
    return `图谱把「${to}」归入「${from}」的知识域或平台适用范围，用于限定阅读范围；这不代表两者存在实车物理连接。`;
  }
  if(edge.type==='fails_as'&&fromNode?.kind==='failure_mode'&&toNode?.kind==='state')return `图谱把「${to}」记录为「${from}」发生后的处置或恢复状态，用于表达故障与重启、重建或冷启动之间的后续关系；这条边不把恢复状态当作故障表现，也不单独证明根因。`;
  const reasons={
    controls:`图谱把「${from}」作为控制请求、策略或状态约束的发起侧，把「${to}」作为接收或执行侧，因此两者构成控制关系。`,
    depends_on:`「${from}」的完成或可用性需要「${to}」提供状态、资源或输出，因此两者构成依赖关系。依赖成立不等于下游结果已经成功。`,
    observed_by:`「${to}」提供判断「${from}」状态或结果所需的日志、计数或状态，因此两者构成观测关系。单个观测点正常不能独立证明端到端正常。`,
    transitions_to:`图谱把「${from}」和「${to}」放在同一状态流程的前后阶段，用于表达允许的状态流转；具体触发条件仍需按当前版本确认。`,
    fails_as:`「${to}」是「${from}」在当前知识模型中的失效表现或结果层级，因此用失效关系连接；它不自动说明更上游根因。`,
    carries_data_to:`「${from}」产生或转交的数据进入「${to}」，所以这是数据路径关系；仍需用同一 transaction、sequence 或 frame 验证真实传递。`,
    sends_to:`「${from}」向「${to}」发送请求、消息或状态，因此两者构成有方向的消息关系。通道在线不等于目标消息已经送达。`,
    publishes:`「${from}」发布「${to}」消费或观察的信息，因此按发布关系连接；还需区分发布成功、路由成功和消费者更新。`,
    powers:`「${from}」为「${to}」提供或控制供电条件，因此属于电源路径；软件状态与实际电压结果需要分别确认。`,
    runs_on:`「${from}」的运行位置被映射到「${to}」，用于明确 Android Guest、Yocto Host、MCU、TBox 或 Hypervisor 的责任边界。`,
    variant_of:`「${from}」和「${to}」描述同一能力在不同平台或版本中的实现变体，因此关联用于比较共性与差异，不能直接互换参数。`,
    conflicts_with:`两份资料或版本对同一关系给出不一致描述，因此显式保留冲突关系，在现车版本确认前不合并为单一事实。`,
    supported_by:`「${to}」是用于支撑或追溯「${from}」的资料/证据节点，因此建立证据关系；是否达到页级证明由证据状态决定。`,
    '主题目录':`「${to}」被放入「${from}」的主题目录，用于从总览进入专题；这是知识导航关系，不代表实车连接。`,
    '主题归类':`图谱按内容主题把「${from}」与「${to}」归到同一知识范围，用于聚合阅读；这不是控制、数据或电源连接的证明。`,
    '主题细分':`「${to}」是「${from}」专题下需要独立理解的子问题或链路，因此建立细分关系；具体技术结论仍由页级证据支撑。`,
    '内容索引':`「${from}」与「${to}」共享内容入口或章节索引，因此可相互导航；索引关系本身不证明技术因果。`,
    '课程顺序':`「${from}」和「${to}」按学习顺序相邻，用于安排阅读路径；先后顺序不代表系统运行时序。`
  };
  return reasons[edge.type]||`图谱将「${from}」与「${to}」记录为“${relationLabel(edge,byId)}”关系。当前关系语义来自知识模型，具体接口和时序需结合对应版本资料核对。`;
}

function relationEvidenceBasis(edge,byId){
  if(edge.evidenceBasis)return edge.evidenceBasis;
  const claims=edge.claims||[];
  if(claims.length){
    const statuses=[...new Set(claims.map(claim=>`${claim.status||edge.status||'reference'}${claim.platforms?.length?`（${claim.platforms.join('/')}）`:''}`))];
    const evidenceIds=[...new Set(claims.flatMap(claim=>claim.evidenceIds||[]))];
    const names=[...new Set(evidenceIds.map(id=>byId.get(id)?.sourceName).filter(Boolean))];
    return `该关系绑定 ${evidenceIds.length} 条页级证据，证据状态为 ${statuses.join('、')}${names.length?`，来源包括 ${names.slice(0,3).join('、')}`:''}。这些状态决定它是原文依据、映射推断还是版本冲突。`;
  }
  if(navigationRelations.has(edge.type))return '这是知识分类或学习导航关系，当前没有页级证据直接绑定；它用于说明内容为什么放在一起，不用于证明实车接口或技术因果。';
  return '当前图谱为这条技术关系未绑定页级证据，因此只能作为结构化理解和待复核线索，不能当作已验证的现车事实。';
}

function relationSupport(edge,byId,selectedId,distance,status,platforms=[]){
  return {id:`${edge.from}:${edge.to}:${edge.type}`,title:relationTitle(edge,byId),relationType:edge.type,direct:edge.from===selectedId||edge.to===selectedId,distance,status:status||edge.status||'reference',platforms,pathLabel:pathLabels[edge.pathClass]||'知识关系'};
}

function evidenceBoundary(status,pages=[]){
  const hasPages=(pages.flat?.(Infinity)||pages).length>0;
  if(status==='page_verified')return hasPages?'已逐页核对并登记页码；技术结论仍受所列平台、版本和章节范围约束。':'状态为逐页核对，但页码缺失，引用需要补全。';
  if(status==='supporting_context')return '这是经过页级核对的背景材料，只支撑所述上下文，不直接证明项目接口或现车实现。';
  if(status==='documented_reference')return hasPages?'这是原文页级引用，可支撑所列关系，但仍需核对车型、版本与上下文。':'状态标为原文依据，但未登记页码，引用强度受限。';
  if(status==='inferred_mapping')return '这是基于资料做出的映射推断，不能直接当作现车事实；当前车型与版本仍需另行验证。';
  if(status==='conflicting')return '资料或版本之间存在冲突，当前只保留差异，不能合并为单一结论。';
  if(['indexed','container_indexed','source_register','reference'].includes(status))return '这是一条资料登记或目录关联，没有页码级结论，只用于定位可能相关的原始资料。';
  if(status==='published_article')return '这是知识库公开学习正文，不是原始手册页级证据。';
  return hasPages?'该引用已定位页码，证据含义仍以状态和原文上下文为准。':'该引用未登记页码，不能单独证明技术结论。';
}

function explainCitation(item){
  const direct=(item.supports||[]).filter(support=>support.direct),indirect=(item.supports||[]).filter(support=>!support.direct);
  const relations=(direct.length?direct:indirect).slice(0,3).map(support=>support.title).join('、');
  item.whyCited=direct.length
    ? `该资料在图谱中直接绑定到所选节点的关系${relations?`：${relations}`:''}，因此用于解释这条关系为什么成立。`
    : `该资料支撑所选专题相邻链路中的关系${relations?`：${relations}`:''}，用于补充上下游语境，不直接证明所选节点本身。`;
  item.evidenceBoundary=evidenceBoundary(item.status,item.pages);
  const substantive=(item.supports||[]).filter(support=>support.relationType!=='supported_by');
  item.displaySupports=substantive.length?substantive:item.supports;
  return item;
}

function evidenceItem(node,status,relation,support,platforms=[]){
  return {
    id:node.id,
    kind:node.kind,
    status:status||node.status||node.processingState||'reference',
    sourceName:node.sourceName||node.title||'原始资料',
    pages:node.pages||[],
    url:node.downloadUrl||node.url,
    summary:node.summary||node.description||'已收录的原始资料，可在线加载或下载后结合对应车型与版本核对。',summaries:[node.summary||node.description||'已收录的原始资料，可在线加载或下载后结合对应车型与版本核对。'],
    relationType:relation?.type||'supported_by',platforms,supports:support?[support]:[]
  };
}

export function buildReaderModel(graph,nodeId,{maxRelations=12,maxCitations=12,maxDepth=1,platforms=[]}={}){
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
  const technicalPaths=groupTechnicalRelations(graph,nodeId,{platforms});
  const insights=Object.values(technicalPaths).flat().slice(0,maxRelations).map(item=>{
    const edge=direct.find(candidate=>(candidate.id&&candidate.id===item.id)||(!candidate.id&&`${candidate.from}:${candidate.to}:${candidate.type}`===item.id));
    return {
      ...item,basis:'structured_technical_relation',
      text:`「${byId.get(item.fromId)?.title||item.fromId}」→「${byId.get(item.toId)?.title||item.toId}」（${relationLabel(edge||item,byId)}）`,
      whyRelated:item.why,evidenceBasis:edge?relationEvidenceBasis({...edge,claims:item.claims},byId):'当前关系未绑定页级证据。',
      evidenceStatuses:[...new Set((item.claims||[]).map(claim=>claim.status||item.status||'reference'))]
    };
  });
  const navigation=direct.filter(edge=>navigationRelations.has(edge.type)||edge.pathClass==='index').map(edge=>{
    const relatedId=edge.from===nodeId?edge.to:edge.from,other=byId.get(relatedId);
    return {id:edge.id||`${edge.from}:${edge.to}:${edge.type}`,relationType:edge.type,relatedId,relatedTitle:other?.title||relatedId,
      whyRelated:relationRationale(edge,byId),direction:edge.from===nodeId?'outgoing':'incoming'};
  });

  const citationByKey=new Map(),visited=new Set([nodeId]),queue=[{id:nodeId,depth:0}];
  const addCitation=(item)=>{
    const key=`${item.sourceName}:${JSON.stringify(item.pages)}:${item.status}:${[...(item.platforms||[])].sort().join(',')}`,existing=citationByKey.get(key);
    if(existing){
      if(item.summary&&!existing.summaries.includes(item.summary)&&existing.summaries.length<3){existing.summaries.push(item.summary);existing.summary=existing.summaries.join('；')}
      for(const support of item.supports||[])if(!existing.supports.some(current=>current.id===support.id&&current.status===support.status))existing.supports.push(support);
      return;
    }
    citationByKey.set(key,item);
  };
  while(queue.length){
    const current=queue.shift();
    for(const edge of graph.edges){
      if(edge.from!==current.id&&edge.to!==current.id)continue;
      const edgeMatchesPlatform=!platforms.length||!(edge.platforms||[]).length||(edge.platforms||[]).some(platform=>platforms.includes(platform));
      const isTechnical=edgeMatchesPlatform&&technicalRelationTypes.has(edge.type)&&edge.layer!=='hierarchy'&&edge.pathClass!=='hierarchy'&&edge.pathClass!=='index';
      const isDirectEvidence=edge.type==='supported_by'&&current.depth===0&&edgeMatchesPlatform;
      if(!isTechnical&&!isDirectEvidence)continue;
      for(const claim of claimsForPlatforms(edge.claims,platforms))for(const evidenceId of claim.evidenceIds||[]){const evidence=byId.get(evidenceId);if(evidence)addCitation(evidenceItem(evidence,claim.status,edge,relationSupport(edge,byId,nodeId,current.depth+1,claim.status,claim.platforms||[]),claim.platforms||[]))}
      const otherId=edge.from===current.id?edge.to:edge.from,other=byId.get(otherId);
      if(!other)continue;
      if(isDirectEvidence&&(other.kind==='evidence'||other.kind==='source'))addCitation(evidenceItem(other,edge.status,edge,relationSupport(edge,byId,nodeId,current.depth+1,edge.status||other.status||other.processingState,edge.platforms||[]),edge.platforms||[]));
      if(isTechnical&&current.depth<maxDepth&&!visited.has(otherId)&&other.kind!=='evidence'&&other.kind!=='source'){
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
  const citations=[...citationByKey.values()].sort((a,b)=>citationPriority(a)-citationPriority(b)).slice(0,maxCitations).map(explainCitation);
  const references=[];
  if(node.url)references.push({
    id:`article:${node.id}`,kind:'article',title:`${node.title} · 学习文章`,url:node.url,pages:node.pages||[],
    status:'published_article',platforms:node.platforms||[],summary:`围绕「${node.title}」整理的公开学习文章，章节定位以链接锚点为准。`,
    whyCited:'该文章是此知识节点对应的公开学习正文，用于补充专题说明、概念边界和阅读入口。',
    evidenceBoundary:evidenceBoundary('published_article',node.pages||[]),supports:[]
  });
  if(node.downloadUrl)references.push({
    id:`source:${node.id}`,kind:'source',title:node.sourceName||node.title,url:node.downloadUrl,pages:node.pages||[],
    status:node.status||node.processingState||'source_register',platforms:node.platforms||[],
    summary:node.summary||node.description||'已收录的原始资料，可在线加载或下载后结合对应车型与版本核对。',
    whyCited:'当前选中的节点就是这份原始资料，因此把它作为专题的直接资料入口。',
    evidenceBoundary:evidenceBoundary(node.status||node.processingState||'source_register',node.pages||[]),supports:[]
  });
  for(const citation of citations)if(citation.url)references.push({
    id:`source:${citation.id}`,kind:'source',title:citation.sourceName,url:citation.url,pages:citation.pages,
    status:citation.status,platforms:citation.platforms||[],summary:citation.summary,whyCited:citation.whyCited,evidenceBoundary:citation.evidenceBoundary,supports:citation.supports,displaySupports:citation.displaySupports
  });
  const uniqueReferences=[...new Map(references.map(item=>[item.url,item])).values()];
  const contentState=node.contentState||(node.knowledge?.role?'absorbed':'awaiting_absorption');
  const responsibility=contentState==='absorbed'?{
    role:node.knowledge.role,input:node.knowledge.input||[],mechanism:node.knowledge.mechanism||[],output:node.knowledge.output||[],
    observations:node.knowledge.observations||[],limits:node.knowledge.limits||[]
  }:{role:'资料尚未吸收',input:[],mechanism:[],output:[],observations:[],limits:[]};
  const breadcrumb=buildBreadcrumb(graph,nodeId).map(item=>({id:item.id,title:item.title,level:item.hierarchyLevel,branchType:item.branchType}));
  const children=directChildren(graph,nodeId).map(item=>({id:item.id,title:item.title,kind:item.kind,branchType:item.branchType,
    role:item.knowledge?.role||item.description||'资料尚未吸收',contentState:item.contentState||(item.knowledge?.role?'absorbed':'awaiting_absorption')}));
  const observations=[...new Set([...(responsibility.observations||[]),...Object.values(technicalPaths).flat().flatMap(item=>item.verification||[])])];
  const summary=contentState==='absorbed'?(node.summary||responsibility.role):(node.summary||node.description||'该节点已完成归类，技术内容尚待吸收。');
  const summaryBasis=contentState==='absorbed'?(node.summary?'curated_summary':'structured_knowledge'):'classification_only';
  const memberships=buildMembershipModel(graph,nodeId);
  const courses=(node.dayIds||[]).map(id=>byId.get(id)).filter(Boolean).map(item=>({id:item.id,title:item.title,kind:item.kind,url:item.url,basis:item.mappingBasis}));
  const skills=(node.skillIds||[]).map(id=>({id,title:id}));
  const cases=(node.cases||[]).map(item=>({
    id:item.id,title:item.title,symptom:item.symptom,evidenceState:item.evidenceState,caseStatus:item.caseStatus,
    confidence:item.confidence,publicSummary:item.publicSummary,normalExpectation:item.normalExpectation,scope:item.scope,
    confirmedFacts:item.confirmedFacts||[],hypotheses:item.hypotheses||[],technicalChain:item.technicalChain||[],
    reportVersions:item.reportVersions||[],evidence:item.evidence||[],tpm:item.tpm||{},projection:item.projection||null,
    projectionKnowledgeId:item.projectionKnowledgeId,mappedNodeId:item.mappedNodeId,platforms:item.platforms||[]
  }));
  const analysis={
    entry:contentState==='awaiting_absorption'?'先补齐当前节点资料、适用版本和正常预期，再进入故障分析。':`先确认车型、软件版本、运行域和正常预期，再沿「${responsibility.role}」的输入、内部机制与输出定位最早可证实断点。`,
    possibilities:[...new Set(cases.flatMap(item=>item.hypotheses||[]))].slice(0,8),
    checkDomains:[...new Set([memberships.primary?.title,...(memberships.secondary||[]).map(item=>item.title)].filter(Boolean))],
    observationPoints:observations.slice(0,10),skills
  };
  const sourceClaims=(node.sourceClaims||[]).map(item=>({...item}));
  for(const item of sourceClaims)if(item.downloadUrl&&!uniqueReferences.some(reference=>reference.url===item.downloadUrl))uniqueReferences.push({
    id:`mapped-source:${item.sourceId}`,kind:'source',title:item.title,url:item.downloadUrl,pages:item.pages||[],status:item.status,
    platforms:item.platform?[item.platform]:[],summary:item.claim||item.basis,whyCited:`${item.basis||'该资料与当前专题存在直接内容映射。'}`,
    evidenceBoundary:item.status==='page_verified'?'已记录页级定位，仍需结合适用版本核对。':'当前是资料索引映射，尚未形成页级技术结论。',supports:[]
  });
  return {
    id:node.id,title:node.title,kind:node.kind,
    summary,summaryBasis,
    scope:{platforms:node.platforms||[],runtimeDomain:node.runtimeDomain||node.domain,version:node.version,status:node.status},
    breadcrumb,memberships,architecture:node.architecture||[],responsibility,children,technicalPaths,observations,citations,references:uniqueReferences,navigation,contentState,insights,
    courses,skills,analysis,cases,sourceClaims,tpm:node.responsibility||{},verification:node.verification||[],
    notice:contentState==='awaiting_absorption'?'该节点已完成层级归类，但资料尚未吸收；分类关系不作为技术结论。':'技术关系优先采用结构化说明；车型、版本、接口编号及时序仍以引用原文和现车资料为准。'
  };
}

function pageText(pages=[]){const flat=pages.flat?.(Infinity)||pages;return flat.length?`第 ${flat.join('、')} 页`:'页码未标注'}

export function readerMarkdown(model){
  if(!model)return'';
  const scope=[...(model.scope.platforms||[]),model.scope.runtimeDomain,model.scope.version].filter(Boolean).join(' · ')||'未限定';
  const basis={curated_summary:'人工整理摘要',structured_knowledge:'结构化知识整理',classification_only:'分类完成、内容待吸收'}[model.summaryBasis]||'知识整理';
  const breadcrumb=(model.breadcrumb||[]).map(item=>item.title).join(' → ')||model.title;
  const lines=[`# ${model.title}`,'',`> 专题总结依据：${basis}`,'',`**所在层级：** ${breadcrumb}`,'',model.summary,'',`**适用范围：** ${scope}`,'','## 本层架构',''];
  if(model.memberships?.primary)lines.push(`- **主要归属：** ${model.memberships.primary.title}`);else lines.push('- **主要归属：** 智能座舱总入口');
  if(model.memberships?.secondary?.length)lines.push(`- **同时关联：** ${model.memberships.secondary.map(item=>item.title).join('、')}`);else lines.push('- **同时关联：** 无已登记交叉归属');
  if(model.architecture?.length){
    lines.push('','```mermaid','flowchart LR');
    model.architecture.forEach((step,index)=>lines.push(`  A${index}["${String(typeof step==='string'?step:step.title||step.label).replaceAll('"','&quot;')}"]`));
    for(let index=0;index<model.architecture.length-1;index++)lines.push(`  A${index} --> A${index+1}`);
    lines.push('```');
  }
  lines.push('','## 本层职责','');
  if(model.contentState==='awaiting_absorption')lines.push('- **资料尚未吸收**：当前只保留层级与分类，不生成技术职责和因果解释。');
  else{
    lines.push(`- **职责：** ${model.responsibility.role}`);
    for(const [label,values] of [['输入',model.responsibility.input],['机制',model.responsibility.mechanism],['输出',model.responsibility.output],['限制',model.responsibility.limits]])for(const value of values||[])lines.push(`- **${label}：** ${value}`);
  }
  lines.push('','## 下级节点','');
  if(model.children?.length)for(const child of model.children)lines.push(`- **${child.title}**：${child.role}`);else lines.push('- 当前节点没有更下一层的公开节点。');
  lines.push('','## 课程','');
  if(model.courses?.length)for(const item of model.courses)lines.push(`- **${item.title}**${item.url?`：${item.url}`:''}`);else lines.push('- 暂无已映射 Day／Week。');
  lines.push('','## 分析','',`- **分析入口：** ${model.analysis.entry}`);
  if(model.analysis.skills?.length)lines.push(`- **适用技能：** ${model.analysis.skills.map(item=>item.id).join('、')}`);else lines.push('- **适用技能：** 待复核。');
  if(model.analysis.possibilities?.length)for(const item of model.analysis.possibilities)lines.push(`- **可能性：** ${item}`);
  if(model.analysis.checkDomains?.length)lines.push(`- **需要检查的域：** ${model.analysis.checkDomains.join('、')}`);
  if(model.analysis.observationPoints?.length)for(const item of model.analysis.observationPoints)lines.push(`- **观测点：** ${item}`);
  lines.push('','## 历史日志案例','');
  if(model.cases?.length)for(const item of model.cases){
    lines.push(`- **${item.title||item.symptom}**（${item.caseStatus||item.evidenceState}，置信度：${item.confidence||'待确认'}）：${item.projection?.summary||item.publicSummary}`);
    if(item.projection?.relationReason)lines.push(`  - **映射到本节点的原因：** ${item.projection.relationReason}`);
    for(const report of item.reportVersions||[])lines.push(`  - **报告版本：** ${report.title}（${report.statusLabel||report.status}）  \n    ${report.url}`);
  }else lines.push('- 当前没有已公开的脱敏案件摘要。');
  lines.push('','## 技术关系及关联原因','');
  const groups=Object.entries(model.technicalPaths||{});
  if(groups.length)for(const [path,items] of groups){
    lines.push(`### ${pathLabels[path]||path}`,'');
    for(const item of items)lines.push(`- **${item.relatedTitle}**：${item.why}\n  - **输入：** ${item.input||'待确认'}\n  - **交接：** ${item.handoff||'待确认'}\n  - **输出：** ${item.output||'待确认'}\n  - **引用依据：** ${item.evidenceBasis||'见引用区'}`);
  }else lines.push('- 当前没有可发布的结构化技术关系。');
  for(const item of model.cases||[])for(const relation of item.technicalChain||[])lines.push(`- **案例链：${item.title||item.symptom}**：${relation.text}\n  - **故障为何传播：** ${relation.failurePropagation}${item.projection?.relationReason?`\n  - **与本节点的关系：** ${item.projection.relationReason}`:''}`);
  lines.push('','## 原始资料与证据','');
  for(const item of model.cases||[]){
    for(const report of item.reportVersions||[])lines.push(`- **分析报告：${report.title}**（${report.statusLabel||report.status}）：${report.summary}  \n  ${report.url}`);
    for(const evidence of item.evidence||[])lines.push(`- **${evidence.id} · ${evidence.source}**（${evidence.type}，${evidence.location}）：${evidence.supports}\n  - **证据边界：** ${evidence.boundary}`);
  }
  if(model.sourceClaims?.length)for(const item of model.sourceClaims.slice(0,40)){
    lines.push(`- **${item.title}**（${pageText(item.pages||[])}，${item.status}）`);
    if(item.claim)lines.push(`  - **学习批注：** ${item.claim}`);
    if(item.basis)lines.push(`  - **为何用于本专题：** ${item.basis}`);
    if(item.section)lines.push(`  - **原文章节：** ${item.section}`);
    if(item.downloadUrl)lines.push(`  - ${item.downloadUrl}`);
  }else lines.push('- 当前没有登记到该节点的原始资料映射。');
  lines.push('','> '+model.notice,'','### 补充引用资料与文章','');
  const representedReferenceUrls=new Set();
  if(model.citations.length)for(const item of model.citations){
    const platformText=item.platforms?.length?`，适用 ${item.platforms.join('/')}`:'';
    lines.push(`- **${item.sourceName}**（${pageText(item.pages)}，${item.status}${platformText}）${item.summary?`：${item.summary}`:''}`);
    lines.push(`  - **为什么引用：** ${item.whyCited}`);
    lines.push(`  - **证据边界：** ${item.evidenceBoundary}`);
    for(const support of (item.displaySupports||item.supports||[]).slice(0,5))lines.push(`  - **支撑关系：** ${support.direct?'直接':'相邻'} · ${support.title}`);
    if(item.url){lines.push(`  - ${item.url}`);representedReferenceUrls.add(item.url)}
  }
  const articleReferences=model.references.filter(item=>item.kind==='article');
  for(const item of articleReferences){const platformText=item.platforms?.length?`，适用 ${item.platforms.join('/')}`:'';lines.push(`- **学习文章：${item.title}**（${pageText(item.pages)}，${item.status||'published_article'}${platformText}）${item.summary?`：${item.summary}`:''}\n  - **为什么引用：** ${item.whyCited}\n  - **证据边界：** ${item.evidenceBoundary}  \n  ${item.url}`);representedReferenceUrls.add(item.url)}
  const sourceReferences=model.references.filter(item=>item.kind==='source'&&!representedReferenceUrls.has(item.url));
  for(const item of sourceReferences){const platformText=item.platforms?.length?`，适用 ${item.platforms.join('/')}`:'';lines.push(`- **原始资料：${item.title}**（${pageText(item.pages)}，${item.status||'source_register'}${platformText}）${item.summary?`：${item.summary}`:''}\n  - **为什么引用：** ${item.whyCited}\n  - **证据边界：** ${item.evidenceBoundary}  \n  ${item.url}`);representedReferenceUrls.add(item.url)}
  if(!model.citations.length&&!articleReferences.length&&!sourceReferences.length)lines.push('- 当前节点暂无已绑定的页码证据或可加载原始资料。');
  lines.push('','## TPM责任与验证关闭','');
  for(const [label,key] of [['触发','trigger'],['首轮牵头','firstRoundLead'],['直接失效责任','directFailureOwner'],['修复责任','repairOwner'],['接口／恢复策略方','interfaceOwner'],['验证方','verifier'],['关闭判据','closure']])if(model.tpm?.[key])lines.push(`- **${label}：** ${model.tpm[key]}`);
  for(const item of model.cases||[])for(const [label,key] of [['触发','trigger'],['首轮牵头','firstRoundLead'],['直接失效责任','directFailureOwner'],['修复责任','repairOwner'],['接口／恢复策略方','interfaceOwner'],['验证方','verifier'],['关闭判据','closure']])if(item.tpm?.[key])lines.push(`- **${item.title||item.symptom} · ${label}：** ${item.tpm[key]}`);
  for(const item of model.verification||[])lines.push(`- **节点验证：** ${item}`);
  if(model.observations?.length)for(const item of model.observations)lines.push(`- **观测点：** ${item}`);
  lines.push('','<details>','<summary>导航关系</summary>','');
  if(model.navigation?.length)for(const item of model.navigation)lines.push(`- ${item.relatedTitle}（${relationLabels[item.relationType]||item.relationType}）：${item.whyRelated}`);else lines.push('- 无');
  lines.push('','</details>');
  lines.push('','---','','生成自座舱知识银河。引用内容应结合对应车型、软件版本和原始资料复核。','');
  return lines.join('\n');
}
