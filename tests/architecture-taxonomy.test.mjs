import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const readJson=async relative=>JSON.parse(await readFile(new URL(relative,import.meta.url),'utf8'));

test('every approved architecture dimension owns at least one detailed L3 chain',async()=>{
  const taxonomy=await readJson('../content/architecture-taxonomy.json');
  assert.equal(taxonomy.dimensions.length,17);
  for(const dimension of taxonomy.dimensions){
    const chains=taxonomy.chains.filter(chain=>chain.primaryParentId===dimension.id);
    assert.ok(chains.length>0,`${dimension.title} has no L3 chain`);
  }
  assert.equal(new Set(taxonomy.chains.map(chain=>chain.id)).size,taxonomy.chains.length);
});

test('shared architecture chains keep one entity and explicit secondary memberships',async()=>{
  const taxonomy=await readJson('../content/architecture-taxonomy.json');
  const byId=new Map(taxonomy.chains.map(chain=>[chain.id,chain]));
  assert.equal(byId.get('chain:someip-service').primaryParentId,'architecture:can-ethernet');
  assert.ok(byId.get('chain:someip-service').secondaryParentIds.includes('architecture:soa'));
  assert.equal(byId.get('chain:str-display-recovery').primaryParentId,'architecture:power');
  assert.deepEqual(byId.get('chain:str-display-recovery').secondaryParentIds.sort(),[
    'architecture:android-hmi-display','architecture:diagnosis-evidence'
  ].sort());
  assert.equal(byId.get('chain:tbox-remote').primaryParentId,'architecture:tbox');
  assert.deepEqual(byId.get('chain:tbox-remote').secondaryParentIds.sort(),[
    'architecture:can-ethernet','architecture:power'
  ].sort());
});

test('compiled graph home is the cockpit architecture rather than legacy parallel indexes',async()=>{
  const graph=await readJson('../docs/graph.json');
  const byId=new Map(graph.nodes.map(node=>[node.id,node]));
  assert.equal(byId.get('root').title,'智能座舱');
  const home=graph.nodes.filter(node=>node.primaryParentId==='root').sort((a,b)=>a.hierarchyOrder-b.hierarchyOrder);
  assert.equal(home.length,17);
  assert.ok(home.every(node=>node.kind==='architecture_dimension'));
  assert.deepEqual(home.map(node=>node.title),[
    '系统概念介绍','MTK平台介绍','MCU与SOC分工','Android、HMI 与显示','应用与Framework',
    'HAL/驱动/硬件抽象','Camera、环视与舱内感知','音频架构','TBox','CAN与以太网',
    'SOA架构','虚拟化通讯','电源管理','升级与信息安全','时间同步','性能与资源','诊断与证据'
  ]);
  const forbidden=new Set(['原始资料','架构课程','TPM 分责与闭环','整机与平台','功能域','业务流程','跨域与生命周期']);
  assert.ok(home.every(node=>!forbidden.has(node.title)));
  assert.equal(graph.meta.architecture.l2Count,17);
  assert.ok(graph.meta.architecture.l3Count>=17);
  assert.ok(graph.meta.architecture.multiParentL3Count>=3);
});

test('all technical entities remain reachable after architecture migration',async()=>{
  const graph=await readJson('../docs/graph.json');
  const byId=new Map(graph.nodes.map(node=>[node.id,node]));
  for(const node of graph.nodes.filter(node=>node.layer==='knowledge')){
    const seen=new Set();let current=node;
    while(current?.primaryParentId&&!seen.has(current.id)){
      seen.add(current.id);current=byId.get(current.primaryParentId);
    }
    assert.equal(current?.id,'root',node.id);
  }
});
