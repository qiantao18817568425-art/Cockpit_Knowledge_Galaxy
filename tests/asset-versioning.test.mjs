import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const index=await readFile(new URL('../docs/index.html',import.meta.url),'utf8');
const app=await readFile(new URL('../docs/app.js',import.meta.url),'utf8');

test('public entry assets use one cache-busting release version',()=>{
  const style=index.match(/href="style\.css\?v=([^"]+)"/);
  const script=index.match(/src="app\.js\?v=([^"]+)"/);
  assert.ok(style,'style.css must carry a release version');
  assert.ok(script,'app.js must carry a release version');
  assert.equal(script[1],style[1]);
});

test('app module dependencies carry the same release version',()=>{
  const entry=index.match(/src="app\.js\?v=([^"]+)"/);
  assert.ok(entry,'app.js must carry a release version');
  for(const moduleName of ['graph-model.js','space-scene.js','reader-actions.js']){
    assert.match(app,new RegExp(`from './${moduleName.replace('.', '\\.') }\\?v=${entry[1]}'`),moduleName);
  }
});
