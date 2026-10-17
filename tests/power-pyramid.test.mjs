import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const graph=JSON.parse(await readFile(new URL('../docs/graph.json',import.meta.url),'utf8'));
const pack=JSON.parse(await readFile(new URL('../content/domain-packs/power.json',import.meta.url),'utf8'));
const taxonomy=JSON.parse(await readFile(new URL('../content/power-taxonomy.json',import.meta.url),'utf8'));
const byId=new Map(graph.nodes.map(node=>[node.id,node]));
const path=id=>{const result=[];const seen=new Set();let node=byId.get(id);while(node&&!seen.has(node.id)){result.push(node.id);seen.add(node.id);node=byId.get(node.primaryParentId)}return result.reverse()};

test('power taxonomy exposes all required L3/L4 learning branches',()=>{
  for(const id of ['state-policy','mcu-handshake','primary-supply','backup-supply','hypervisor-barrier','device-suspend','low-power-residency','wake-source','business-resume']){
    const nodeId=`subtopic:power:${id}`,ids=path(nodeId);
    assert.deepEqual(ids.slice(0,3),['root','pyramid:lifecycle','domain:power'],nodeId);
    assert.ok(ids.length>=5,nodeId);
  }
  assert.ok(taxonomy.every(item=>item.knowledge?.role&&item.knowledge?.observations?.length));
});

test('power semantic nodes attach to the appropriate lifecycle stages',()=>{
  const expected={
    'component:vehicle-power-input':'subtopic:power:state-input',
    'component:mcu-power-manager':'subtopic:power:mcu-handshake',
    'component:pmic':'subtopic:power:primary-supply',
    'component:backup-power':'subtopic:power:backup-supply',
    'process:kernel-suspend':'subtopic:power:device-suspend',
    'observation:wake-source':'subtopic:power:wake-source',
    'observation:suspend-abort':'subtopic:power:abort-or-wake'
  };
  for(const [id,parent] of Object.entries(expected))assert.equal(byId.get(id).primaryParentId,parent,id);
});

test('control, state, physical power and diagnostic paths stay distinct',()=>{
  for(const cls of ['control','state','power','diagnostic'])assert.ok(pack.relations.some(item=>item.pathClass===cls),cls);
  for(const relation of pack.relations){
    assert.ok(relation.why&&relation.input&&relation.handoff&&relation.output,relation.id);
    assert.ok(relation.verification?.length,relation.id);
  }
  for(const entity of pack.entities)assert.ok(entity.knowledge?.role&&entity.knowledge?.observations?.length,entity.id);
  assert.ok(pack.relations.filter(item=>item.type==='transitions_to').every(item=>item.pathClass==='state'));
  assert.equal(byId.get('state:power-suspended').primaryParentId,'subtopic:power:low-power-residency');
  assert.notEqual(byId.get('component:pmic').primaryParentId,byId.get('state:power-suspended').primaryParentId);
});
