import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const index=await readFile(new URL('../docs/index.html',import.meta.url),'utf8');
const boot=await readFile(new URL('../docs/boot.js',import.meta.url),'utf8').catch(()=> '');
const legacy=await readFile(new URL('../docs/app-legacy.js',import.meta.url),'utf8').catch(()=> '');
const three=await readFile(new URL('../docs/app-three.js',import.meta.url),'utf8').catch(()=> '');

test('public entry assets use one cache-busting release version',()=>{
  const style=index.match(/href="style\.css\?v=([^"]+)"/);
  const script=index.match(/src="boot\.js\?v=([^"]+)"/);
  assert.ok(style,'style.css must carry a release version');
  assert.ok(script,'boot.js must carry a release version');
  assert.equal(script[1],style[1]);
});

test('boot and legacy module dependencies carry the same release version',()=>{
  const entry=index.match(/src="boot\.js\?v=([^"]+)"/);
  assert.ok(entry,'boot.js must carry a release version');
  for(const moduleName of ['app-legacy.js']){
    assert.match(boot,new RegExp(`\\./${moduleName.replace('.', '\\.') }\\?v=${entry[1]}`),moduleName);
  }
  assert.match(boot,new RegExp(`\\./hybrid-app\\.js\\?v=${entry[1]}`));
  for(const moduleName of ['graph-model.js','space-scene.js','reader-actions.js']){
    assert.match(legacy,new RegExp(`from './${moduleName.replace('.', '\\.') }\\?v=${entry[1]}'`),moduleName);
  }
});
