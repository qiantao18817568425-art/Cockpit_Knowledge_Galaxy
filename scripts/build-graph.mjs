import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {loadKnowledgeContent, compileKnowledgeGraph} from './lib/knowledge-model.mjs';
import {embedCases} from './lib/case-model.mjs';
import {
  loadArchitectureTaxonomy,applyArchitectureTaxonomy,loadHierarchy,applyHierarchy,
  validateHierarchy,validateSecondaryParents,buildHierarchyEdges,buildSecondaryHierarchyEdges
} from './lib/hierarchy-model.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceArg = process.argv.indexOf('--source');
const sourceRoot = path.resolve(sourceArg >= 0 ? process.argv[sourceArg + 1] : path.join(projectRoot, '..', 'Architecture_Learning-'));
const siteBase = 'https://qiantao18817568425-art.github.io/Architecture_Learning-/';
const archDir = path.join(sourceRoot, 'docs', 'architecture');
const lessonDir = path.join(sourceRoot, 'docs', 'lessons');
const powerTaxonomy = JSON.parse(await readFile(path.join(projectRoot, 'content', 'power-taxonomy.json'), 'utf8'));
const rawTaxonomy = JSON.parse(await readFile(path.join(projectRoot, 'content', 'raw-taxonomy.json'), 'utf8'));
const rawCatalog = JSON.parse(await readFile(path.join(projectRoot, 'docs', 'raw-sources.json'), 'utf8'));
const sourceRegister = JSON.parse(await readFile(path.join(projectRoot, 'content', 'source-register.json'), 'utf8'));
const learningMapping = JSON.parse(await readFile(path.join(projectRoot, 'content', 'learning-mapping.json'), 'utf8'));
const skillMapping = JSON.parse(await readFile(path.join(projectRoot, 'content', 'skill-mapping.json'), 'utf8'));
const caseRegister = JSON.parse(await readFile(path.join(projectRoot, 'content', 'case-register.json'), 'utf8'));
const learningById = new Map(learningMapping.items.map(item=>[item.id,item]));

function plain(value) {
  return value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

const topics = [
  ['system', '整机与平台', '系统边界、平台基线和整体架构'],
  ['virtualization', '虚拟化', 'Hypervisor、Host 与 Guest 边界'],
  ['android', 'Android AAOS', 'Android 服务、应用与系统机制'],
  ['yocto', 'Yocto Host', '宿主系统与平台服务'],
  ['mcu', 'MCU 与车信号', 'MCU、电源控制和车辆接口'],
  ['tbox', 'TBox 与连接', '车联网通信与外部连接'],
  ['display', '显示与 HMI', '显示、首帧与人机界面'],
  ['camera', 'Camera / AVM', '视频采集、环视与帧流'],
  ['audio', '音频与语音', '播放、采集与音频策略'],
  ['power', '电源与生命周期', '休眠、唤醒、启动与恢复'],
  ['cross', '跨域通信', '接口、消息与状态同步'],
  ['diagnosis', '诊断与证据', '日志、复盘与工程验证'],
  ['raw', '原始资料', '按平台、技术域与文件版本检索原始资料；当前为分类目录']
];

// A topic is an index node, so its reading link points to a public entry chapter.
// Keep these chapter numbers in chapterTopics as well, so the link and graph agree.
const topicLandingChapters = {
  system:'02', virtualization:'02', android:'06', yocto:'07', mcu:'08',
  tbox:'09', display:'11', camera:'11', audio:'12', power:'14',
  cross:'05', diagnosis:'15'
};

const chapterTopics = {
  '00':['system'],'01':['system'],'02':['system','virtualization'],'03':['system'],'04':['system'],
  '05':['cross','diagnosis'],'06':['android'],'07':['yocto'],'08':['mcu','power'],'09':['tbox','power'],
  '10':['mcu','cross'],'11':['display','camera'],'12':['audio'],'13':['tbox','cross'],
  '14':['power'],'15':['diagnosis','power'],'16':['diagnosis'],'17':['system'],'18':['yocto'],
  '19':['camera'],'20':['cross'],'21':['diagnosis'],'22':['diagnosis'],'23':['diagnosis','power'],'24':['power','display']
};

const keywordTopics = [
  [/虚拟化|hypervisor|\bvm\b|virtio|tee/i,'virtualization'],
  [/android|aaos|carservice|binder/i,'android'],
  [/yocto|sos|weston/i,'yocto'],
  [/mcu|can\b|车信号|车身/i,'mcu'],
  [/tbox|蜂窝|车联网|远控/i,'tbox'],
  [/显示|黑屏|首帧|hmi|launcher|触摸/i,'display'],
  [/camera|avm|环视|摄像|视频/i,'camera'],
  [/audio|音频|语音|功放|tts|aec/i,'audio'],
  [/str|resume|休眠|唤醒|电源|启动|恢复/i,'power'],
  [/some.ip|ethernet|以太网|跨域|通信|消息|网络|服务发现/i,'cross'],
  [/诊断|故障|日志|证据|复盘|测试|闭环/i,'diagnosis']
];

function classify(title) {
  const found = keywordTopics.filter(([re]) => re.test(title)).map(([,id]) => id);
  return [...new Set(found)].slice(0, 2).length ? [...new Set(found)].slice(0, 2) : ['system'];
}

const nodes = [{ id:'root', title:'座舱知识', kind:'root', description:'公开架构章节与每日学习课程的关系入口。', url:siteBase, source:'公开学习站点' }];
const edges = [];
for (const [id,title,description] of topics) {
  const chapter = topicLandingChapters[id];
  if (id !== 'raw' && (!chapter || !chapterTopics[chapter]?.includes(id))) throw new Error(`Invalid topic reading chapter: ${id}`);
  nodes.push({ id:`topic:${id}`, title, kind:'topic', description, navigationOnly:true,
    url:id==='raw'?'./raw-sources.html':`${siteBase}architecture/${chapter}.html`,
    source:id==='raw'?'原始资料分类目录':`公开架构章节 · ${chapter} 章入门` });
  edges.push({ from:'root', to:`topic:${id}`, type:'主题目录' });
}

const chapterNumbers = (await readdir(archDir)).filter(name=>/^\d{2}\.html$/.test(name)).map(name=>name.slice(0,2)).sort();
for (const number of chapterNumbers) {
  const html = await readFile(path.join(archDir, `${number}.html`), 'utf8');
  const title = plain(html.match(/<title>(.*?)<\/title>/i)?.[1]?.split(' · ')[0] || `${number} 章`);
  const assignedTopics=chapterTopics[number] || classify(title);
  nodes.push({ id:`chapter:${number}`, title:`${number} ${title}`, kind:'chapter', description:'公开架构正文。主题关联用于导航，不代表当前车型连接已被实车验证。', url:`${siteBase}architecture/${number}.html`, source:'座舱架构实践 · 中文版', topics:assignedTopics });
  for (const topic of assignedTopics) edges.push({ from:`topic:${topic}`, to:`chapter:${number}`, type:'主题归类' });
}

const home = await readFile(path.join(sourceRoot,'docs','index.html'),'utf8');
const publishedLessons = new Set((await readdir(lessonDir)).filter(name => name.endsWith('.html')).map(name => name.slice(0,-5)));
const lessonPattern = /<details\b[^>]*class="lesson"[^>]*id="(day-\d+|week-[^"]+)"[^>]*>\s*<summary>\s*<span class="lesson-title">([\s\S]*?)<\/span>/g;
const seen = new Set();
for (const match of home.matchAll(lessonPattern)) {
  const id = match[1];
  if (seen.has(id)) continue;
  seen.add(id);
  const title = plain(match[2]);
  const kind = id.startsWith('day-') ? 'lesson' : 'review';
  const url = publishedLessons.has(id) ? `${siteBase}lessons/${id}.html` : `${siteBase}#${id}`;
  const assignedTopics = classify(title);
  const explicitLearning=learningById.get(`course:${id}`);
  nodes.push({ id:`course:${id}`, title, kind, description:kind==='lesson'?'公开每日课程。课程发布不代表已完成或掌握。':'公开周复盘。课程发布不代表已完成或掌握。', url, source:'座舱架构学习 · 课程档案', topics:assignedTopics,
    knowledgeIds:explicitLearning?.knowledgeIds||[],mappingBasis:explicitLearning?.basis,primaryParentId:explicitLearning?.knowledgeIds?.[0] });
  for (const topic of assignedTopics) edges.push({ from:`topic:${topic}`, to:`course:${id}`, type:'主题归类' });
  for(const knowledgeId of explicitLearning?.knowledgeIds||[])edges.push({id:`index:learning:${knowledgeId}:course:${id}`,from:knowledgeId,to:`course:${id}`,type:'内容索引',pathClass:'index',layer:'index',hiddenByDefault:true});
}

const knownIds = new Set(nodes.map(node => node.id));
for (const branch of powerTaxonomy) {
  const id = `subtopic:power:${branch.id}`;
  if (knownIds.has(id)) throw new Error(`Duplicate power branch: ${id}`);
  if (!branch.sourcePath.startsWith('architecture/')) throw new Error(`Unexpected power source: ${branch.sourcePath}`);
  const parentId = branch.parent ? `subtopic:power:${branch.parent}` : 'topic:power';
  if (!knownIds.has(parentId)) throw new Error(`Missing power parent ${parentId} for ${id}`);
  if (branch.parent && nodes.find(node => node.id === parentId)?.parentId !== 'topic:power') throw new Error(`Power paths must have a category parent: ${id}`);
  const linked = [
    ...branch.chapters.map(number => `chapter:${number}`),
    ...branch.lessons.map(lesson => `course:${lesson}`)
  ];
  for (const target of linked) if (!knownIds.has(target)) throw new Error(`Missing power target ${target} for ${id}`);
  nodes.push({
    id, title:branch.title, kind:'subtopic', description:branch.description, knowledge:branch.knowledge,
    branchType:branch.parent?'subchain':'chain', contentState:branch.knowledge?.role?'absorbed':'awaiting_absorption',
    url:`${siteBase}${branch.sourcePath}`, source:'公开架构章节 · 电源细分索引', topics:['power'], parentId, depth:branch.parent?2:1
  });
  knownIds.add(id);
  edges.push({ from:parentId, to:id, type:'主题细分' });
  for (const target of linked) edges.push({ from:id, to:target, type:'内容索引' });
}

const rawCategoryCounts = new Map(rawCatalog.categories.map(category=>[category.id,category.count]));
for (const category of rawTaxonomy) {
  const id = `subtopic:raw:${category.id}`;
  if (knownIds.has(id) || !rawCategoryCounts.has(category.id)) throw new Error(`Invalid raw category: ${id}`);
  for (const chapter of category.chapters) if (!knownIds.has(`chapter:${chapter}`)) throw new Error(`Missing raw chapter ${chapter}`);
  for (const topic of category.topics) if (!knownIds.has(`topic:${topic}`)) throw new Error(`Missing raw topic ${topic}`);
  const sourceCount=rawCategoryCounts.get(category.id);
  nodes.push({id,title:category.title,kind:'subtopic',description:`${sourceCount} 份去重原始资料的分类入口；每份资料的页级结论在其实际归属的架构节点中展示。`,
    summary:`本目录管理 ${sourceCount} 份「${category.title}」原始资料的检索、版本和证据状态。它是资料账本入口，技术结论已分散到对应的二级、三级和四级专题。`,
    knowledge:{role:`管理「${category.title}」原始资料的检索、下载、版本和映射状态。`,input:['去重文件、平台、版本和页码索引'],mechanism:['保留原始文件下载入口','把资料映射到具体架构链路','用 page_verified、supporting_context 或 indexed 区分证据强度'],output:['可追溯的资料目录和专题来源批注'],observations:['文件 hash、平台、版本、页数和处理状态'],limits:['资料分类只用于证据管理，不代表该分类本身是实车技术组件。']},contentState:'absorbed',
    url:`./raw-sources.html?category=${category.id}`,source:'原始资料分类目录',topics:['raw'],parentId:'topic:raw',depth:1});
  knownIds.add(id);
  edges.push({from:'topic:raw',to:id,type:'主题细分'});
  for (const chapter of category.chapters) edges.push({from:id,to:`chapter:${chapter}`,type:'内容索引'});
  for (const topic of category.topics) edges.push({from:id,to:`topic:${topic}`,type:'主题归类'});
}

const daily = nodes.filter(n=>n.kind==='lesson').sort((a,b)=>Number(a.id.slice(11))-Number(b.id.slice(11)));
for(let i=1;i<daily.length;i++) edges.push({ from:daily[i-1].id, to:daily[i].id, type:'课程顺序' });
const reviews = nodes.filter(n=>n.kind==='review');
const knowledgeModel = await loadKnowledgeContent(path.join(projectRoot,'content','domain-packs'));
knowledgeModel.sources = sourceRegister.documents.map(item=>({
  id:item.id,name:item.name,title:item.name,downloadUrl:item.downloadUrl,platforms:[item.platform],version:item.version,
  processingState:item.processingState,knowledgeIds:item.knowledgeIds,knowledgeMappings:item.knowledgeMappings,category:item.category,
  summary:item.contentDigest?.summary,contentDigest:item.contentDigest,
  // Raw files live in the evidence catalogue. Their knowledgeMappings remain
  // index/evidence links and must never turn a PDF into a child knowledge node.
  primaryParentId:`subtopic:raw:${item.category}`
}));
const semantic = compileKnowledgeGraph(knowledgeModel);
const duplicateSemantic = semantic.nodes.find(node=>knownIds.has(node.id));
if(duplicateSemantic) throw new Error(`Semantic node collides with navigation node: ${duplicateSemantic.id}`);
nodes.push(...semantic.nodes);
edges.push(...semantic.edges);

// Bridge the legacy learning navigation, semantic entities, platforms and source register.
// These are index relations rather than technical claims, so they do not require evidence claims.
const semanticById = new Map(semantic.nodes.map(node=>[node.id,node]));
const topicDomains = {
  system:['domain:platform'], virtualization:['domain:virtualization','domain:security'],
  android:['domain:android'], yocto:['domain:yocto'], mcu:['domain:mcu'],
  tbox:['domain:tbox','domain:connectivity'], display:['domain:display','domain:hmi'],
  camera:['domain:camera'], audio:['domain:audio'], power:['domain:power','domain:lifecycle'],
  cross:['domain:cross-domain','domain:connectivity'],
  diagnosis:['domain:diagnosis','domain:assurance','domain:performance','domain:usb-storage']
};
for(const [topic,domains] of Object.entries(topicDomains))for(const domain of domains)if(semanticById.has(domain)){
  edges.push({id:`index:topic:${topic}:${domain}`,from:`topic:${topic}`,to:domain,type:'主题归类',pathClass:'index',layer:'index'});
}
const domainIds = {
  platform:'domain:platform',virtualization:'domain:virtualization',android:'domain:android',yocto:'domain:yocto',mcu:'domain:mcu',
  tbox:'domain:tbox',connectivity:'domain:connectivity',display:'domain:display',hmi:'domain:hmi',camera:'domain:camera',audio:'domain:audio',
  power:'domain:power','cross-domain':'domain:cross-domain',lifecycle:'domain:lifecycle',usb:'domain:usb-storage',security:'domain:security',
  assurance:'domain:assurance',performance:'domain:performance',diagnosis:'domain:diagnosis'
};
for(const node of semantic.nodes){
  if(['source','evidence','domain'].includes(node.kind))continue;
  const domainId=domainIds[node.domain];
  if(domainId&&semanticById.has(domainId)&&domainId!==node.id)edges.push({id:`index:domain:${domainId}:${node.id}`,from:domainId,to:node.id,type:'belongs_to',pathClass:'index',layer:'index'});
  if(!['platform'].includes(node.kind))for(const platform of node.platforms||[]){
    const platformId=`platform:${platform.toLocaleLowerCase()}`;
    if(semanticById.has(platformId))edges.push({id:`index:platform:${platformId}:${node.id}`,from:platformId,to:node.id,type:'belongs_to',pathClass:'index',layer:'index'});
  }
}
for(const node of semantic.nodes.filter(node=>node.kind==='source'))for(const knowledgeId of node.knowledgeIds||[])if(semanticById.has(knowledgeId)){
  edges.push({id:`index:source:${node.id}:${knowledgeId}`,from:node.id,to:knowledgeId,type:'belongs_to',pathClass:'index',layer:'index',hiddenByDefault:true});
}
const architectureTaxonomy=await loadArchitectureTaxonomy(path.join(projectRoot,'content','architecture-taxonomy.json'));
const dimensionAbsorption=JSON.parse(await readFile(path.join(projectRoot,'content','dimension-absorption.json'),'utf8'));
const hierarchy=await loadHierarchy(path.join(projectRoot,'content','hierarchy.json'));
const architectureNodes=applyArchitectureTaxonomy(nodes,architectureTaxonomy);
const hierarchicalNodes=applyHierarchy(architectureNodes,hierarchy);
const hierarchicalById=new Map(hierarchicalNodes.map(node=>[node.id,node]));
const mergeAbsorption=(node,absorbed)=>{
  if(!node||!absorbed)return;
  Object.assign(node,absorbed,{sourceClaims:[...(absorbed.sourceClaims||[])]});
  node.contentState='absorbed';
  node.referenceState='page_verified';
};
mergeAbsorption(hierarchicalById.get('root'),dimensionAbsorption.root);
for(const [id,absorbed] of Object.entries(dimensionAbsorption.dimensions||{}))mergeAbsorption(hierarchicalById.get(id),absorbed);
const addUnique=(node,key,value)=>{if(!node)return;node[key]=[...new Set([...(node[key]||[]),value])];};
for(const item of learningMapping.items)for(const knowledgeId of item.knowledgeIds||[])addUnique(hierarchicalById.get(knowledgeId),'dayIds',item.id);
for(const item of skillMapping.skills)for(const knowledgeId of item.knowledgeIds||[])addUnique(hierarchicalById.get(knowledgeId),'skillIds',item.id);
embedCases(hierarchicalNodes,architectureTaxonomy,caseRegister);
for(const source of sourceRegister.documents)for(const mapping of source.knowledgeMappings||[]){
  const target=hierarchicalById.get(mapping.knowledgeId);if(!target)continue;
  target.sourceClaims=target.sourceClaims||[];
  target.sourceClaims.push({sourceId:source.id,title:source.name,downloadUrl:source.downloadUrl,platform:source.platform,version:source.version,...mapping});
}
const leadByChain={
  'chain:display-output':'显示/HMI 域','chain:touch-input':'输入与 HMI 域','chain:avm-video-flow':'Camera/AVM 域',
  'chain:audio-paths':'音频域','chain:ethernet-connectivity':'网络/BSP 域','chain:someip-service':'SOA 与网络接口双方',
  'chain:power-lifecycle':'MCU 电源与 SoC 电源双方','chain:str-display-recovery':'电源、虚拟化与显示联合',
  'chain:runtime-boundaries':'虚拟化平台域','chain:cross-domain-transport':'接口提供方与消费方',
  'chain:stability':'直接失效所在运行域','chain:evidence-ledger':'TPM 与当前主链路技术牵头域'
};
for(const node of hierarchicalNodes.filter(item=>item.kind==='architecture_chain')){
  const referenceCount=(node.dayIds?.length||0)+(node.sourceClaims?.length||0)+(node.skillIds?.length||0)+(node.caseIds?.length||0);
  if(!referenceCount)node.referenceState='awaiting_review';
  node.responsibility={
    trigger:'该链出现用户现象、异常状态或关键观测缺失时触发分析。',
    firstRoundLead:leadByChain[node.id]||'主要归属架构域（具体团队待确认）',
    directFailureOwner:'由统一时间线中的最早可证实断点确定，不依据最后一条错误或恢复动作倒推。',
    repairOwner:'根因组件或策略的责任域；跨域问题同时保留接口与恢复策略责任。',
    verifier:'系统测试与问题提出方；具体人员和期限待项目确认。',
    closure:'触发场景、正常路径、异常恢复、相关版本及共享资源回归均满足判据。'
  };
  node.verification=['确认车型、SoC、软硬件版本和实际拓扑','统一时基与 boot/VM generation','逐接口核对输入、状态、输出和完成语义','验证修复及异常恢复并保留可复核证据'];
}
for(const node of hierarchicalNodes.filter(item=>item.id?.startsWith('process:tpm-'))){node.hiddenByDefault=true;node.navigationOnly=true;}
const hierarchyIssues=validateHierarchy(hierarchicalNodes,{rootId:hierarchy.rootId||'root'});
if(hierarchyIssues.length)throw new Error(`Hierarchy invalid:\n${hierarchyIssues.join('\n')}`);
const secondaryIssues=validateSecondaryParents(hierarchicalNodes,{allowedParentLevel:1});
if(secondaryIssues.length)throw new Error(`Secondary hierarchy invalid:\n${secondaryIssues.join('\n')}`);
const hierarchyEdges=buildHierarchyEdges(hierarchicalNodes);
const secondaryHierarchyEdges=buildSecondaryHierarchyEdges(hierarchicalNodes);
const absorbedRelations=(dimensionAbsorption.relations||[]).map(edge=>({...edge,layer:'architecture_relation',evidenceState:'explained'}));
for(const edge of absorbedRelations){
  if(!hierarchicalById.has(edge.from)||!hierarchicalById.has(edge.to))throw new Error(`Absorbed relation references missing node: ${edge.id}`);
}
edges.push(...hierarchyEdges,...secondaryHierarchyEdges,...absorbedRelations);
const data = {
  meta: {
    title:'座舱知识银河',
    sourceSite:siteBase,
    sourceUpdatedOn:(JSON.parse(await readFile(path.join(sourceRoot,'content','learning-progress.json'),'utf8'))).updatedOn,
    chapterCount:chapterNumbers.length,
    lessonCount:daily.length,
    reviewCount:reviews.length,
    subtopicCount:powerTaxonomy.length,
    powerCategoryCount:powerTaxonomy.filter(branch => !branch.parent).length,
    powerPathCount:powerTaxonomy.filter(branch => branch.parent).length,
    rawCategoryCount:rawTaxonomy.length,
    rawDocumentCount:rawCatalog.documents.length,
    semantic:semantic.meta,
    sourceCoverage:{total:sourceRegister.summary.publicDocuments,mapped:sourceRegister.summary.mappedDocuments,
      archiveDocuments:sourceRegister.summary.archiveDocuments,processingStates:sourceRegister.summary.processingStates},
    referenceMapping:{learning:learningMapping.items.length,skills:skillMapping.skills.length,cases:caseRegister.cases.length,
      concreteSources:sourceRegister.documents.filter(item=>item.knowledgeMappings?.length).length},
    hierarchy:{nodeCount:hierarchicalNodes.length,edgeCount:hierarchyEdges.length+secondaryHierarchyEdges.length,maxLevel:Math.max(...hierarchicalNodes.map(node=>node.hierarchyLevel||0))},
    architecture:{
      l2Count:architectureTaxonomy.dimensions.length,
      l3Count:architectureTaxonomy.chains.length,
      multiParentL3Count:architectureTaxonomy.chains.filter(node=>(node.secondaryParentIds||[]).length).length,
      l4Count:hierarchicalNodes.filter(node=>node.hierarchyLevel===3).length
    },
    layers:{hierarchy:true,navigation:true,knowledge:true,evidence:'on-demand'},
    relationNotice:'层级线表达架构归属；技术线表达控制、数据、电源、状态或诊断关系。引用状态决定其是否可作为当前车型证据。'
  },
  nodes:hierarchicalNodes, edges
};
await mkdir(path.join(projectRoot,'docs'),{recursive:true});
await writeFile(path.join(projectRoot,'docs','graph.json'),JSON.stringify(data,null,2)+'\n','utf8');
await writeFile(path.join(projectRoot,'docs','source-register.json'),JSON.stringify(sourceRegister,null,2)+'\n','utf8');
console.log(`Graph generated: ${hierarchicalNodes.length} nodes, ${edges.length} edges; ${daily.length} days, ${reviews.length} reviews.`);
