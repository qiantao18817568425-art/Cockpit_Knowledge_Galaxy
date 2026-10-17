import test from 'node:test';import assert from 'node:assert/strict';
import {buildReaderModel,detailModel,expandEvidenceNeighborhood,rankSearchResults,readerMarkdown,visibleNodeIds} from '../docs/graph-model.js';
const graph={nodes:[
 {id:'a',title:'SleepManager',description:'协调系统进入休眠并跟踪恢复条件。',aliases:['休眠管理器'],kind:'component',layer:'knowledge',platforms:['MT8676'],url:'https://example/article'},
 {id:'b',title:'PMIC',description:'执行电源轨控制。',kind:'component',layer:'knowledge',platforms:['MT8676']},
 {id:'c',title:'电源轨状态',description:'用于确认硬件供电结果。',kind:'observation',layer:'knowledge',platforms:['MT8676']},
 {id:'ev',title:'证据',kind:'evidence',layer:'evidence',hiddenByDefault:true,status:'documented_reference',summary:'手册第 4 页说明 PMIC 与电源轨状态。',sourceName:'manual.pdf',pages:[4],downloadUrl:'https://example/a'},
 {id:'ev2',title:'证据 2',kind:'evidence',layer:'evidence',hiddenByDefault:true,status:'documented_reference',summary:'同页还说明了状态回读。',sourceName:'manual.pdf',pages:[4],downloadUrl:'https://example/a'},
 {id:'ev3',title:'推断证据',kind:'evidence',layer:'evidence',hiddenByDefault:true,status:'inferred_mapping',summary:'同页内容被用于另一平台的推断映射。',sourceName:'manual.pdf',pages:[4],downloadUrl:'https://example/a'},
 {id:'src',title:'manual.pdf',kind:'source',layer:'evidence',hiddenByDefault:true,downloadUrl:'https://example/source.pdf'}
],edges:[
 {from:'a',to:'b',type:'controls',pathClass:'control'},
 {from:'b',to:'c',type:'observed_by',pathClass:'power',claims:[{status:'documented_reference',evidenceIds:['ev','ev2']},{status:'inferred_mapping',evidenceIds:['ev3']}]},
 {from:'a',to:'ev',type:'supported_by',pathClass:'diagnostic'},{from:'ev',to:'src',type:'supported_by',pathClass:'diagnostic'}]};
test('search ranks aliases and platform filters',()=>assert.equal(rankSearchResults(graph.nodes,'休眠',{platforms:['MT8676']})[0].id,'a'));
test('evidence is hidden by default and expands for incoming or outgoing selected relations',()=>{assert.ok(!visibleNodeIds(graph,{}).has('ev'));const ids=visibleNodeIds(graph,{selectedId:'a',evidenceVisible:true});assert.ok(ids.has('ev'));assert.ok(ids.has('src'));assert.deepEqual(expandEvidenceNeighborhood(graph,'b'),new Set(['b','ev','ev2','ev3','src']))});
test('path filters retain connected knowledge nodes',()=>{const ids=visibleNodeIds(graph,{pathClasses:['control']});assert.ok(ids.has('a')&&ids.has('b'))});
test('details include evidence scope source page and URL',()=>{const d=detailModel(graph,'b');assert.deepEqual(d.platforms,['MT8676']);assert.equal(d.evidence[0].sourceName,'manual.pdf');assert.deepEqual(d.evidence[0].pages,[4]);assert.match(d.evidence[0].url,/^https:/)});
test('reader model separates authored summary, graph-derived insight and cited evidence',()=>{
 const model=buildReaderModel(graph,'a');
 assert.equal(model.summary,'协调系统进入休眠并跟踪恢复条件。');
 assert.equal(model.insights[0].basis,'graph_relation');
 assert.match(model.insights.map(x=>x.text).join(' '),/PMIC/);
 assert.equal(model.citations[0].sourceName,'manual.pdf');
 assert.deepEqual(model.citations[0].pages,[4]);
 assert.equal(model.references[0].kind,'article');
 assert.match(model.insights[0].whyRelated,/控制/);
 assert.match(model.insights[0].evidenceBasis,/未绑定页级证据/);
});
test('reader markdown includes synthesis provenance, citation pages and load links',()=>{
 const markdown=readerMarkdown(buildReaderModel(graph,'a'));
 assert.match(markdown,/图谱关系衍生/);
 assert.match(markdown,/manual\.pdf.*第 4 页/);
 assert.match(markdown,/https:\/\/example\/a/);
 assert.match(markdown,/https:\/\/example\/article/);
});
test('reader model exposes a selected raw source as a downloadable reference',()=>{
 const model=buildReaderModel(graph,'src');
 assert.equal(model.references[0].kind,'source');
 assert.equal(model.references[0].url,'https://example/source.pdf');
});
test('topic reader prioritizes topic branches and synthesizes them into the summary',()=>{
 const topicGraph={nodes:[
  {id:'t',title:'电源专题',kind:'topic',description:'围绕上下电与休眠。'},
  {id:'chapter',title:'课程章节',kind:'chapter',description:'导航章节。'},
  {id:'branch',title:'MCU 电源握手',kind:'subtopic',description:'核对请求、应答和供电结果。'}
 ],edges:[
  {from:'t',to:'chapter',type:'主题归类'},
  {from:'t',to:'branch',type:'主题细分'}
 ]};
 const model=buildReaderModel(topicGraph,'t',{maxRelations:1});
 assert.equal(model.insights[0].relatedId,'branch');
 assert.equal(model.summaryBasis,'graph_synthesis');
 assert.match(model.summary,/MCU 电源握手/);
});
test('citations from the same source pages merge only when their evidence status matches',()=>{
 const model=buildReaderModel(graph,'b');
 assert.equal(model.citations.length,2);
 assert.deepEqual(model.citations.map(item=>item.status).sort(),['documented_reference','inferred_mapping']);
 assert.match(model.citations.find(item=>item.status==='documented_reference').summary,/状态回读/);
 assert.match(model.citations.find(item=>item.status==='inferred_mapping').summary,/推断映射/);
 const relation=model.insights.find(item=>item.relatedId==='c');
 assert.match(relation.whyRelated,/观测/);
 assert.match(relation.evidenceBasis,/documented_reference/);
 const documented=model.citations.find(item=>item.status==='documented_reference');
 assert.match(documented.whyCited,/直接绑定/);
 assert.ok(documented.supports.some(item=>item.direct&&/PMIC.*电源轨状态/.test(item.title)));
 assert.match(model.citations.find(item=>item.status==='inferred_mapping').evidenceBoundary,/不能直接当作现车事实/);
});
test('indirect citations explain the adjacent relation and do not claim direct proof',()=>{
 const indirectGraph={nodes:graph.nodes,edges:graph.edges.filter(edge=>!(edge.from==='a'&&edge.to==='ev'))};
 const model=buildReaderModel(indirectGraph,'a');
 const citation=model.citations.find(item=>item.sourceName==='manual.pdf'&&item.status==='documented_reference');
 assert.equal(citation.supports.some(item=>item.direct),false);
 assert.match(citation.whyCited,/相邻链路/);
 assert.match(citation.evidenceBoundary,/原文页级/);
 const article=model.references.find(item=>item.kind==='article');
 assert.match(article.whyCited,/公开学习正文/);
 assert.match(article.evidenceBoundary,/不是原始手册页级证据/);
});
test('direct source neighbors and learning articles expose complete reference metadata',()=>{
 const sourceGraph={nodes:[
  {id:'knowledge',title:'HMI',kind:'domain',description:'显示与交互域。',url:'https://example/hmi.html'},
  {id:'manual',title:'HMI Manual.pdf',kind:'source',processingState:'indexed',downloadUrl:'https://example/hmi.pdf'}
 ],edges:[{from:'knowledge',to:'manual',type:'supported_by'}]};
 const model=buildReaderModel(sourceGraph,'knowledge');
 assert.equal(model.citations[0].sourceName,'HMI Manual.pdf');
 assert.equal(model.citations[0].status,'indexed');
 assert.match(model.citations[0].summary,/原始资料/);
 assert.match(model.citations[0].whyCited,/直接绑定/);
 assert.match(model.citations[0].evidenceBoundary,/资料登记/);
 const article=model.references.find(item=>item.kind==='article');
 assert.equal(article.status,'published_article');
 assert.match(article.summary,/公开学习文章/);
});
test('page evidence is retained when direct source registrations exceed the citation limit',()=>{
 const sources=Array.from({length:13},(_,i)=>({id:`source-${i}`,title:`source-${i}.pdf`,kind:'source',processingState:'indexed',downloadUrl:`https://example/source-${i}.pdf`}));
 const overflowGraph={nodes:[
  {id:'knowledge',title:'虚拟化',kind:'domain',description:'虚拟化知识域。'},
  ...sources,
  {id:'evidence',title:'页级证据',kind:'evidence',status:'inferred_mapping',sourceName:'hypervisor.pdf',pages:[27],summary:'第 27 页用于推断当前平台映射。',downloadUrl:'https://example/hypervisor.pdf'}
 ],edges:[
  ...sources.map(source=>({from:'knowledge',to:source.id,type:'supported_by'})),
  {from:'knowledge',to:'evidence',type:'supported_by'}
 ]};
 const model=buildReaderModel(overflowGraph,'knowledge',{maxCitations:12});
 assert.equal(model.citations.length,12);
 assert.equal(model.citations[0].sourceName,'hypervisor.pdf');
 assert.deepEqual(model.citations[0].pages,[27]);
 assert.equal(model.citations[0].status,'inferred_mapping');
});
test('belongs_to explains source membership in the domain without reversing containment',()=>{
 const membershipGraph={nodes:[
  {id:'manual',title:'MT8668 Android IPO 手册',kind:'source',processingState:'indexed'},
  {id:'android',title:'Android AAOS',kind:'domain',description:'Android 座舱运行域。'}
 ],edges:[{from:'manual',to:'android',type:'belongs_to',pathClass:'index'}]};
 const model=buildReaderModel(membershipGraph,'manual');
 assert.match(model.insights[0].whyRelated,/原始资料/);
 assert.match(model.insights[0].whyRelated,/归入.*Android AAOS/);
 assert.doesNotMatch(model.insights[0].whyRelated,/Android AAOS.*纳入.*手册/);
});
test('fails_as distinguishes recovery transitions from failure manifestations',()=>{
 const recoveryGraph={nodes:[
  {id:'crash',title:'App / Process Crash',kind:'failure_mode'},
  {id:'restart',title:'Process Restart',kind:'state'}
 ],edges:[{from:'crash',to:'restart',type:'fails_as',pathClass:'control'}]};
 const model=buildReaderModel(recoveryGraph,'crash');
 assert.match(model.insights[0].whyRelated,/发生后的处置或恢复状态/);
 assert.doesNotMatch(model.insights[0].whyRelated,/失效表现或结果层级/);
});

