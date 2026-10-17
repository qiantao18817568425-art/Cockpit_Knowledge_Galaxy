import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const graph=JSON.parse(await readFile(new URL('../docs/graph.json',import.meta.url),'utf8'));
const pack=JSON.parse(await readFile(new URL('../content/domain-packs/platform-runtime.json',import.meta.url),'utf8'));
const byId=new Map(graph.nodes.map(node=>[node.id,node]));
const path=id=>{const result=[];const seen=new Set();let node=byId.get(id);while(node&&!seen.has(node.id)){result.push(node.id);seen.add(node.id);node=byId.get(node.primaryParentId)}return result.reverse()};

test('MT8668 and MT8676 share one platform family path and keep variant evidence',()=>{
  assert.deepEqual(path('platform:mt8668').slice(0,4),['root','pyramid:platform','domain:platform','chain:platform-family']);
  assert.deepEqual(path('platform:mt8676').slice(0,4),['root','pyramid:platform','domain:platform','chain:platform-family']);
  const relation=pack.relations.find(item=>item.id==='rel:runtime:002');
  assert.equal(relation.scope,'shared');
  assert.match(relation.why,/共性|差异|平台|变体/);
  assert.ok(pack.claims.find(item=>item.relationId===relation.id).evidenceIds.length>=2);
});

test('runtime domains and cross-domain transports have visible drill branches',()=>{
  for(const id of ['component:hypervisor','component:android-guest','component:yocto-host','component:mcu','component:tbox'])assert.ok(path(id).some(value=>value==='chain:runtime-boundaries'),id);
  for(const id of ['interface:fdbus','interface:someip','interface:vsock','interface:virtio','interface:spi-ipcl'])assert.ok(path(id).some(value=>value==='chain:cross-domain-transport'),id);
  assert.equal(byId.get('interface:binder').primaryParentId,'chain:android-internal-ipc');
});

test('platform entities and technical handoffs have structured explanations',()=>{
  for(const entity of pack.entities){
    assert.ok(entity.knowledge?.role,entity.id);
    assert.ok((entity.knowledge.input?.length||0)+(entity.knowledge.mechanism?.length||0)+(entity.knowledge.output?.length||0)>=2,entity.id);
    assert.ok(entity.knowledge.observations?.length,entity.id);
  }
  for(const relation of pack.relations){
    assert.ok(relation.why&&relation.input&&relation.handoff&&relation.output,relation.id);
    assert.ok(relation.verification?.length,relation.id);
    if(relation.from==='component:android-guest'&&relation.to==='interface:binder')assert.match(relation.handoff,/Android|Guest|进程/);
  }
});
