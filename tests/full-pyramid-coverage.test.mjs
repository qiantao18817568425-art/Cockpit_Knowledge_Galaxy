import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';

const dir=new URL('../content/domain-packs/',import.meta.url);
const packs=await Promise.all((await readdir(dir)).filter(name=>name.endsWith('.json')).map(async name=>JSON.parse(await readFile(new URL(name,dir),'utf8'))));
const graph=JSON.parse(await readFile(new URL('../docs/graph.json',import.meta.url),'utf8'));
const entities=packs.flatMap(pack=>pack.entities),relations=packs.flatMap(pack=>pack.relations),byId=new Map(graph.nodes.map(node=>[node.id,node]));
const path=id=>{const result=[];const seen=new Set();let node=byId.get(id);while(node&&!seen.has(node.id)){result.push(node.id);seen.add(node.id);node=byId.get(node.primaryParentId)}return result.reverse()};

test('every semantic entity has one root path and absorbed knowledge or an explicit gap',()=>{
  for(const entity of entities){
    const ids=path(entity.id);assert.equal(ids[0],'root',entity.id);
    if(entity.contentState==='awaiting_absorption'){
      assert.equal(entity.knowledge,undefined,entity.id);
    }else{
      assert.ok(entity.knowledge?.role&&entity.knowledge.role!==entity.title,entity.id);
      const filled=['input','mechanism','output'].filter(key=>entity.knowledge[key]?.length);
      assert.ok(filled.length>=2,entity.id);
      assert.ok(entity.knowledge.observations?.length,entity.id);
    }
  }
});

test('every published technical relation has an explanation, evidence status and verification',()=>{
  for(const relation of relations){
    assert.ok(relation.pathClass,relation.id);
    assert.ok(relation.status,relation.id);
    assert.ok(relation.why&&relation.input&&relation.handoff&&relation.output,relation.id);
    assert.ok(relation.verification?.length,relation.id);
  }
});

test('domain stages remain separate in hierarchy and technical paths',()=>{
  const relation=id=>relations.find(item=>item.id===id);
  assert.equal(relation('rel:hmi:006').pathClass,'control');
  assert.equal(relation('rel:hmi:007').pathClass,'data');
  assert.notEqual(byId.get('process:audio-playback').id,byId.get('process:audio-capture').id);
  assert.ok(path('component:ethernet-phy').includes('chain:ethernet-connectivity'));
  assert.ok(path('process:l3-connectivity').includes('chain:ethernet-connectivity'));
  assert.deepEqual(['component:usb-connector','component:usb-controller','component:block-device','component:filesystem-volume'].map(id=>byId.get(id).primaryParentId),Array(4).fill('chain:usb-storage'));
  assert.deepEqual(['interface:tee-transport','component:tee-service','component:secure-storage'].map(id=>byId.get(id).primaryParentId),Array(3).fill('chain:tee-security'));
  assert.equal(relation('rel:assurance:001').type,'fails_as');
  assert.match(relation('rel:assurance:001').why,/直接失效|恢复|进程/);
  assert.ok(path('observation:cpu-io-memory').includes('chain:performance-diagnosis'));
});
