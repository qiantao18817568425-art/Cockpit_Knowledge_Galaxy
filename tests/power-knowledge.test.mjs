import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateKnowledgeModel} from '../scripts/lib/knowledge-model.mjs';
const pack=JSON.parse(await readFile(new URL('../content/domain-packs/power.json',import.meta.url),'utf8'));
const register=JSON.parse(await readFile(new URL('../content/source-register.json',import.meta.url),'utf8'));
const model={...pack,sources:register.documents};

test('power domain covers the end-to-end control, state, power and observation paths',()=>{
  assert.deepEqual(validateKnowledgeModel(model),[]);
  const ids=new Set(pack.entities.map(x=>x.id));
  for(const id of ['component:vehicle-power-input','component:mcu-power-manager','interface:gpio-wake','interface:spi-ipcl','component:yocto-sleep-manager','component:hypervisor-barrier','component:android-guest','component:tbox-guest','process:kernel-suspend','component:atf','component:spm','component:pmic','component:mt6363','component:backup-power','observation:framework-wake','observation:suspend-abort','observation:wake-after-suspend']) assert.ok(ids.has(id),id);
  for(const cls of ['control','power','diagnostic']) assert.ok(pack.relations.some(x=>x.pathClass===cls),cls);
  assert.ok(pack.relations.some(x=>x.type==='transitions_to'));
  assert.equal(pack.claims.length,pack.relations.length);
  assert.equal(pack.evidence.length,pack.relations.length);
});

