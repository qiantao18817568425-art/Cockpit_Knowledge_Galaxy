import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  applyHierarchy,
  applyArchitectureTaxonomy,
  breadcrumbIds,
  buildHierarchyEdges,
  buildSecondaryHierarchyEdges,
  loadArchitectureTaxonomy,
  loadHierarchy,
  validateSecondaryParents,
  validateHierarchy
} from '../scripts/lib/hierarchy-model.mjs';

const fixture=async name=>JSON.parse(await readFile(new URL(`fixtures/${name}`,import.meta.url),'utf8'));

test('valid hierarchy has a single continuous root path',async()=>{
  const {nodes}=await fixture('hierarchy-valid.json');
  assert.deepEqual(validateHierarchy(nodes,{rootId:'root'}),[]);
  assert.deepEqual(breadcrumbIds(nodes,'component:physical-display'),[
    'root','pyramid:functional','domain:display','chain:display-output','component:physical-display'
  ]);
  const edges=buildHierarchyEdges(nodes);
  assert.equal(edges.length,nodes.length-1);
  assert.ok(edges.every(edge=>edge.type==='primary_contains'&&edge.pathClass==='hierarchy'&&edge.layer==='hierarchy'));
});

test('invalid hierarchy reports every structural failure',async()=>{
  const {nodes}=await fixture('hierarchy-invalid.json');
  const issues=validateHierarchy(nodes,{rootId:'root'});
  for(const fragment of ['missing parent','cycle','level gap','unreachable','multiple assignment']){
    assert.ok(issues.some(issue=>issue.includes(fragment)),`${fragment}: ${issues.join(' | ')}`);
  }
});

test('hierarchy application preserves explicit assignments and applies exact fallbacks',async()=>{
  const hierarchy=await loadHierarchy(new URL('../content/hierarchy.json',import.meta.url));
  const input=[
    {id:'root',title:'座舱知识',kind:'root'},
    {id:'chapter:01',title:'章节',kind:'chapter'},
    {id:'course:day-1',title:'课程',kind:'lesson'},
    {id:'subtopic:raw:display',title:'显示资料',kind:'subtopic',parentId:'topic:raw'},
    {id:'source-a',title:'资料',kind:'source',category:'display'},
    {id:'ev-a',title:'证据',kind:'evidence',sourceId:'source-a'},
    {id:'domain:display',title:'显示与触控',kind:'domain',domain:'display'},
    {id:'component:generic-display-test',title:'通用显示组件',kind:'component',domain:'display'}
  ];
  const applied=applyHierarchy(input,hierarchy);
  const byId=new Map(applied.map(node=>[node.id,node]));
  assert.equal(byId.get('chapter:01').primaryParentId,'chain:system-overview');
  assert.equal(byId.get('course:day-1').primaryParentId,'chain:system-overview');
  assert.equal(byId.get('source-a').primaryParentId,'chain:display-output');
  assert.equal(byId.get('ev-a').primaryParentId,'source-a');
  assert.equal(byId.get('component:generic-display-test').primaryParentId,'domain:display');
});

test('architecture taxonomy exposes the approved 17 ordered dimensions',async()=>{
  const taxonomy=await loadArchitectureTaxonomy(new URL('../content/architecture-taxonomy.json',import.meta.url));
  assert.equal(taxonomy.root.id,'root');
  assert.equal(taxonomy.root.title,'智能座舱');
  assert.deepEqual(taxonomy.dimensions.map(item=>item.title),[
    '系统概念介绍','MTK平台介绍','MCU与SOC分工','Android、HMI 与显示','应用与Framework',
    'HAL/驱动/硬件抽象','Camera、环视与舱内感知','音频架构','TBox','CAN与以太网',
    'SOA架构','虚拟化通讯','电源管理','升级与信息安全','时间同步','性能与资源','诊断与证据'
  ]);
  assert.equal(new Set(taxonomy.dimensions.map(item=>item.id)).size,17);
  assert.deepEqual(taxonomy.dimensions.map(item=>item.order),Array.from({length:17},(_,index)=>(index+1)*10));
});

test('one shared L3 entity yields one primary and multiple secondary hierarchy edges',()=>{
  const taxonomy={
    root:{id:'root',title:'智能座舱'},
    dimensions:[
      {id:'architecture:can-ethernet',title:'CAN与以太网',order:10},
      {id:'architecture:soa',title:'SOA架构',order:20},
      {id:'architecture:virtual-communication',title:'虚拟化通讯',order:30}
    ],
    chains:[{
      id:'chain:someip',title:'SOME/IP 服务通信',order:10,
      primaryParentId:'architecture:can-ethernet',
      secondaryParentIds:['architecture:soa','architecture:virtual-communication']
    }]
  };
  const nodes=applyArchitectureTaxonomy([{id:'root',title:'旧名称',kind:'root'}],taxonomy);
  const shared=nodes.filter(node=>node.id==='chain:someip');
  assert.equal(shared.length,1);
  assert.equal(shared[0].hierarchyLevel,2);
  assert.deepEqual(validateSecondaryParents(nodes,{allowedParentLevel:1}),[]);
  assert.equal(buildHierarchyEdges(nodes).filter(edge=>edge.to==='chain:someip').length,1);
  assert.deepEqual(buildSecondaryHierarchyEdges(nodes).filter(edge=>edge.to==='chain:someip').map(edge=>edge.from),[
    'architecture:soa','architecture:virtual-communication'
  ]);
});

test('secondary parent validation rejects malformed multi-membership',async()=>{
  const fixtureValue=await fixture('architecture-taxonomy-invalid.json');
  const issues=validateSecondaryParents(fixtureValue.nodes,{allowedParentLevel:1});
  for(const fragment of ['missing secondary parent','self membership','duplicate secondary parent','repeats primary parent','must be level 1']){
    assert.ok(issues.some(issue=>issue.includes(fragment)),`${fragment}: ${issues.join(' | ')}`);
  }
});
