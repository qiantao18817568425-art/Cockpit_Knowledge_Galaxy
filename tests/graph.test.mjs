import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const graph = JSON.parse(await readFile(new URL('../docs/graph.json', import.meta.url),'utf8'));
const rawCatalog = JSON.parse(await readFile(new URL('../docs/raw-sources.json', import.meta.url),'utf8'));
const ids = new Set(graph.nodes.map(n=>n.id));
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = ['upstream', '../Architecture_Learning-'].map(p=>path.resolve(projectRoot,p)).find(p=>existsSync(path.join(p,'docs','index.html')));

test('public learning content is complete and traceable',()=>{
  assert.ok(graph.nodes.filter(n=>n.kind==='chapter').length>=25);
  assert.ok(graph.nodes.filter(n=>n.kind==='lesson').length>=44);
  assert.ok(graph.nodes.filter(n=>n.kind==='review').length>=23);
  assert.equal(graph.meta.chapterCount,graph.nodes.filter(n=>n.kind==='chapter').length);
  assert.equal(graph.meta.lessonCount,graph.nodes.filter(n=>n.kind==='lesson').length);
  assert.equal(graph.meta.reviewCount,graph.nodes.filter(n=>n.kind==='review').length);
  for(const node of graph.nodes.filter(n=>['chapter','lesson','review'].includes(n.kind))) {
    assert.ok(node.url?.startsWith(graph.meta.sourceSite),node.id);
  }
});

test('every edge resolves and states a navigation or semantic relation',()=>{
  assert.equal(ids.size,graph.nodes.length);
  for(const edge of graph.edges){
    assert.ok(ids.has(edge.from),edge.from);
    assert.ok(ids.has(edge.to),edge.to);
    assert.ok(['primary_contains','secondary_contains','主题目录','主题归类','主题细分','内容索引','课程顺序','belongs_to','runs_on','controls','sends_to','publishes','subscribes','carries_data_to','powers','transitions_to','depends_on','observed_by','fails_as','supported_by','variant_of','conflicts_with','supersedes'].includes(edge.type),edge.type);
  }
});

test('every published node has one reachable primary hierarchy path',()=>{
  const hierarchyEdges=graph.edges.filter(edge=>edge.type==='primary_contains');
  const parents=new Map();
  for(const edge of hierarchyEdges){
    assert.equal(edge.pathClass,'hierarchy');
    assert.equal(edge.layer,'hierarchy');
    assert.ok(!parents.has(edge.to),`multiple primary parents: ${edge.to}`);
    parents.set(edge.to,edge.from);
  }
  assert.equal(hierarchyEdges.length,graph.nodes.length-1);
  for(const node of graph.nodes){
    if(node.id==='root'){assert.equal(node.hierarchyLevel,0);continue;}
    assert.equal(parents.get(node.id),node.primaryParentId,node.id);
    const seen=new Set();let cursor=node.id;
    while(cursor!=='root'){
      assert.ok(!seen.has(cursor),`cycle: ${node.id}`);seen.add(cursor);
      cursor=parents.get(cursor);assert.ok(cursor,`unreachable: ${node.id}`);
    }
  }
  assert.equal(graph.meta.hierarchy.nodeCount,graph.nodes.length);
});

test('legacy navigation stays hidden inside architecture chains instead of becoming home branches',()=>{
  assert.equal(graph.nodes.some(node=>node.id.startsWith('pyramid:')),false);
  for(const node of graph.nodes.filter(node=>node.kind==='topic')){
    assert.ok(node.primaryParentId?.startsWith('chain:'),node.id);
    assert.equal(node.navigationOnly,true,node.id);
    assert.equal(node.hiddenByDefault,true,node.id);
  }
  assert.equal(graph.nodes.find(node=>node.id==='domain:power').primaryParentId,'chain:power-lifecycle');
  assert.equal(graph.nodes.find(node=>node.id==='domain:virtualization').primaryParentId,'chain:runtime-boundaries');
});

test('every public reading link resolves to a published file and heading', async()=>{
  assert.ok(sourceRoot,'public source checkout is required for link validation');
  const sourceSite = new URL(graph.meta.sourceSite);
  const cache = new Map();
  for (const node of graph.nodes.filter(node=>!['knowledge','evidence','hierarchy'].includes(node.layer))) {
    assert.ok(node.url,`Missing reading link: ${node.id}`);
    if (node.url.startsWith('./raw-sources.html')) {
      assert.ok(existsSync(path.join(projectRoot,'docs','raw-sources.html')),node.id);
      const category = new URL(node.url,'https://example.invalid/').searchParams.get('category');
      if (category) assert.ok(rawCatalog.categories.some(item=>item.id===category),node.id);
      continue;
    }
    const url = new URL(node.url);
    assert.equal(url.origin,sourceSite.origin,node.id);
    assert.ok(url.pathname.startsWith(sourceSite.pathname),node.id);
    const relative = decodeURIComponent(url.pathname.slice(sourceSite.pathname.length)) || 'index.html';
    const file = path.join(sourceRoot,'docs',relative);
    assert.ok(existsSync(file),`${node.id}: ${relative}`);
    if (!url.hash) continue;
    if (!cache.has(file)) cache.set(file,new Set([...((await readFile(file,'utf8')).matchAll(/\bid="([^"]+)"/g))].map(match=>match[1])));
    assert.ok(cache.get(file).has(decodeURIComponent(url.hash.slice(1))),`${node.id}: ${relative}${url.hash}`);
  }
  for (const topic of graph.nodes.filter(node=>node.kind==='topic')) {
    if (topic.id==='topic:raw') continue;
    assert.ok(graph.nodes.some(node=>node.kind==='chapter'&&node.url===topic.url&&graph.edges.some(edge=>edge.from===topic.id&&edge.to===node.id)),topic.id);
  }
});

test('semantic graph is evidence backed and covers every public source',()=>{
  assert.equal(graph.meta.sourceCoverage.total,299);
  assert.equal(graph.meta.sourceCoverage.mapped,299);
  assert.ok(graph.meta.semantic.entityCount>=100);
  assert.ok(graph.meta.semantic.relationCount>=70);
  const evidenceIds=new Set(graph.nodes.filter(x=>x.kind==='evidence').map(x=>x.id));
  const sourceIds=new Set(graph.nodes.filter(x=>x.kind==='source').map(x=>x.id));
  assert.equal(sourceIds.size,299);
  for(const node of graph.nodes.filter(x=>['source','evidence'].includes(x.kind)))assert.equal(node.hiddenByDefault,true,node.id);
  for(const edge of graph.edges.filter(x=>x.layer==='knowledge')){
    assert.ok(edge.claims?.length,edge.id);
    for(const claim of edge.claims)for(const evidenceId of claim.evidenceIds)assert.ok(evidenceIds.has(evidenceId),evidenceId);
  }
  for(const node of graph.nodes.filter(x=>x.kind==='evidence')){assert.ok(sourceIds.has(node.sourceId),node.id);assert.match(node.downloadUrl,/^https:\/\//)}
  assert.ok(!JSON.stringify(graph).includes('I:\\'));
  assert.ok(graph.nodes.filter(x=>!x.hiddenByDefault).length<350,'default view must remain bounded');
});

test('cockpit root, domains, platforms and sources form one navigable knowledge graph',()=>{
  const adjacency=new Map(graph.nodes.map(node=>[node.id,new Set()]));
  for(const edge of graph.edges){adjacency.get(edge.from).add(edge.to);adjacency.get(edge.to).add(edge.from)}
  for(const id of ['platform:mt8668','platform:mt8676','domain:platform','domain:power','domain:android'])assert.ok(adjacency.get(id)?.size>0,`${id} is isolated`);
  const reached=new Set(['root']),queue=['root'];
  while(queue.length){const id=queue.shift();for(const other of adjacency.get(id)||[])if(!reached.has(other)){reached.add(other);queue.push(other)}}
  for(const node of graph.nodes.filter(node=>node.layer==='knowledge'))assert.ok(reached.has(node.id),`${node.id} is disconnected from cockpit root`);
  for(const node of graph.nodes.filter(node=>node.kind==='source'))assert.ok(adjacency.get(node.id)?.size>0,`${node.id} has no knowledge mapping edge`);
  assert.ok(graph.edges.some(edge=>edge.type==='variant_of'&&new Set([edge.from,edge.to]).has('platform:mt8668')&&new Set([edge.from,edge.to]).has('platform:mt8676')),'MT8668 and MT8676 need an explicit shared-family relation');
});

test('raw materials have a distinct category and complete classified directory',()=>{
  const categories=graph.nodes.filter(node=>node.id.startsWith('subtopic:raw:'));
  assert.equal(categories.length,graph.meta.rawCategoryCount);
  assert.equal(categories.length,rawCatalog.categories.length);
  assert.equal(graph.meta.rawDocumentCount,rawCatalog.documents.length);
  assert.equal(new Set(rawCatalog.documents.map(document=>document.id)).size,rawCatalog.documents.length);
  const valid=new Set(rawCatalog.categories.map(category=>category.id));
  for(const document of rawCatalog.documents){
    assert.ok(valid.has(document.category),document.id);
    assert.ok(document.name&&document.format,document.id);
    assert.match(document.sha256,/^[0-9a-f]{64}$/);
    for(const chapter of document.chapterCandidates)assert.ok(ids.has(`chapter:${chapter}`),document.id);
    if(document.downloadUrl){
      assert.ok(document.downloadUrl.startsWith('https://'),document.id);
      const url=new URL(document.downloadUrl);
      if(url.hostname.endsWith('.github.io')){
        const relative=url.pathname.replace('/Cockpit_Knowledge_Galaxy/','');
        assert.ok(existsSync(path.join(projectRoot,'docs',relative)),document.id);
      }
    }
  }
  for(const category of categories){
    assert.equal(category.parentId,'topic:raw');
    assert.ok(graph.edges.some(edge=>edge.from==='topic:raw'&&edge.to===category.id),category.id);
  }
  assert.ok(!JSON.stringify(rawCatalog).includes('I:\\学习资料'),'local source paths must not be published');
});

test('power management has traceable, detailed learning paths',()=>{
  const branches=graph.nodes.filter(node=>node.kind==='subtopic'&&node.id.startsWith('subtopic:power:'));
  assert.equal(branches.length,graph.meta.subtopicCount);
  assert.equal(graph.meta.powerCategoryCount,branches.filter(node=>node.depth===1).length);
  assert.equal(graph.meta.powerPathCount,branches.filter(node=>node.depth===2).length);
  assert.ok(graph.meta.powerCategoryCount>=10);
  assert.ok(graph.meta.powerPathCount>=20);
  for(const branch of branches){
    assert.ok(branch.url?.startsWith(graph.meta.sourceSite+'architecture/'),branch.id);
    assert.ok(graph.edges.some(edge=>edge.from===branch.parentId&&edge.to===branch.id&&edge.type==='主题细分'),branch.id);
    if(branch.depth===1)assert.equal(branch.parentId,'topic:power',branch.id);
    else assert.ok(branches.some(parent=>parent.id===branch.parentId&&parent.depth===1),branch.id);
    assert.ok(graph.edges.filter(edge=>edge.from===branch.id&&edge.type==='内容索引').length>=2,branch.id);
  }
  const powerTargets=new Set(graph.edges.filter(edge=>edge.from.startsWith('subtopic:power:')).map(edge=>edge.to));
  for(const target of ['chapter:08','chapter:09','chapter:14','chapter:15','chapter:23','chapter:24','course:day-7','course:day-8','course:day-38','course:day-39']){
    assert.ok(powerTargets.has(target),target);
  }
});
