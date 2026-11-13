import test from 'node:test';
import assert from 'node:assert/strict';

import {selectRenderer,startRenderer} from '../docs/boot.js';

test('renderer query forces canvas while available WebGL selects three',()=>{
  assert.equal(selectRenderer({query:'?renderer=canvas',webglAvailable:true}),'canvas');
  assert.equal(selectRenderer({query:'?renderer=three',webglAvailable:false}),'canvas');
  assert.equal(selectRenderer({query:'',webglAvailable:true}),'three');
  assert.equal(selectRenderer({query:'',webglAvailable:true,desktop:false}),'canvas');
  assert.equal(selectRenderer({query:'',webglAvailable:false}),'canvas');
});

test('boot imports only the selected renderer entry',async()=>{
  const loaded=[];
  const result=await startRenderer({mode:'three',importModule:async name=>loaded.push(name)});
  assert.equal(result,'three');
  assert.deepEqual(loaded,['app-three']);
});

test('canvas selection never imports the Three.js entry and starts the current reader',async()=>{
  const loaded=[];
  let starts=0;
  globalThis.__GALAXY_BRIDGE__={startCanvasRenderer(){starts++}};
  await startRenderer({mode:'canvas',importModule:async name=>loaded.push(name)});
  assert.deepEqual(loaded,['app']);
  assert.equal(starts,1);
  delete globalThis.__GALAXY_BRIDGE__;
});

