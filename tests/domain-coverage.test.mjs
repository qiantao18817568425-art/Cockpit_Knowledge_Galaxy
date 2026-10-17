import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {validateKnowledgeModel} from '../scripts/lib/knowledge-model.mjs';
const dir=new URL('../content/domain-packs/',import.meta.url);
const packs=await Promise.all((await readdir(dir)).filter(x=>x.endsWith('.json')).map(async x=>JSON.parse(await readFile(new URL(x,dir),'utf8'))));
const register=JSON.parse(await readFile(new URL('../content/source-register.json',import.meta.url),'utf8'));
const merged={sources:register.documents,entities:packs.flatMap(x=>x.entities),relations:packs.flatMap(x=>x.relations),claims:packs.flatMap(x=>x.claims),evidence:packs.flatMap(x=>x.evidence)};
const ids=new Set(merged.entities.map(x=>x.id));

test('platform runtime knowledge has scoped boundaries and interfaces',()=>{
  for(const id of ['platform:mt8668','platform:mt8676','component:android-guest','component:yocto-host','component:mcu','component:tbox','component:hypervisor','interface:binder','interface:fdbus','interface:someip','interface:vsock','interface:virtio','interface:spi-ipcl','observation:sequence','observation:freshness','observation:boot-generation','observation:request-id']) assert.ok(ids.has(id),id);
  const shared=merged.relations.find(x=>x.type==='variant_of'&&x.from==='platform:mt8676'&&x.to==='platform:mt8668');assert.ok(shared,'platform commonality relation missing');
  assert.equal(shared.scope,'shared');
  assert.ok(merged.claims.find(x=>x.relationId===shared.id).evidenceIds.length>=2,'both platform references are required');
});
test('HMI media knowledge separates control, frame, playback and capture paths',()=>{
  for(const id of ['component:android-display','component:yocto-display','component:physical-display','component:backlight','interface:input-event','observation:first-frame','component:camera-control','interface:camera-frame','component:avm-stitch','observation:camera-four-stream','process:audio-playback','process:audio-capture','component:aec-reference','component:dsp-variant']) assert.ok(ids.has(id),id);
  for(const id of ['component:android-display','component:yocto-display','component:physical-display','component:backlight']){
    const entity=merged.entities.find(item=>item.id===id);
    assert.ok(entity.knowledge?.role&&entity.knowledge?.observations?.length,id);
  }
  for(const id of ['rel:hmi:001','rel:hmi:002','rel:hmi:003','rel:hmi:004','rel:hmi:005']){
    const relation=merged.relations.find(item=>item.id===id);
    assert.ok(relation.why&&relation.verification?.length,id);
  }
  const displayClaims=merged.claims.filter(item=>item.relationId==='rel:hmi:001');
  assert.ok(displayClaims.some(item=>item.status==='documented_reference'&&item.platforms?.includes('MT8676')));
  assert.ok(displayClaims.some(item=>item.status==='inferred_mapping'&&item.platforms?.includes('MT8668')));
  assert.equal(displayClaims.some(item=>item.status==='documented_reference'&&item.platforms?.includes('MT8668')),false);
});
test('connectivity lifecycle knowledge preserves layered boundaries',()=>{
  for(const id of ['component:ethernet-pcs','component:ethernet-phy','process:l3-connectivity','component:wifi-sta','component:wifi-softap','process:phone-link','component:modem','process:remote-wake','state:cold-boot','state:str-resume','state:vm-recreate','state:process-restart','component:usb-connector','component:usb-controller','component:block-device','component:filesystem-volume','interface:tee-transport','component:tee-service','component:secure-storage']) assert.ok(ids.has(id),id);
});
test('assurance knowledge separates failure, evidence, amplification and closure',()=>{
  for(const id of ['failure:app-crash','failure:system-server','failure:vm-reset','failure:host-reset','process:db-ke-forensics','observation:first-fatal','observation:cpu-io-memory','observation:frame-chain','component:log-producer','component:log-retention','failure:log-storm','process:tpm-trigger','process:tpm-direct-failure','process:tpm-recovery','process:tpm-verification']) assert.ok(ids.has(id),id);
});
test('all sources map to knowledge or an explicit terminal review state',()=>{
  for(const item of register.documents) assert.ok(item.knowledgeIds.length||['superseded_duplicate','container_indexed','needs_visual_review','metadata_only','out_of_scope_support_file'].includes(item.processingState),item.id);
  assert.equal(register.documents.filter(x=>x.processingState==='indexed'&&!x.knowledgeIds.length).length,0);
  assert.deepEqual(validateKnowledgeModel(merged),[]);
});
