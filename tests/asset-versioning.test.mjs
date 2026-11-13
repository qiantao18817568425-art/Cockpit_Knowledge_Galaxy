import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const index=await readFile(new URL('../docs/index.html',import.meta.url),'utf8');
const boot=await readFile(new URL('../docs/boot.js',import.meta.url),'utf8');
const app=await readFile(new URL('../docs/app.js',import.meta.url),'utf8');
const three=await readFile(new URL('../docs/app-three.js',import.meta.url),'utf8');
const webgl=await readFile(new URL('../docs/starmap-webgl.js',import.meta.url),'utf8');

test('public entry assets use one cache-busting release version',()=>{
  const style=index.match(/href="style\.css\?v=([^"]+)"/);
  const script=index.match(/src="boot\.js\?v=([^"]+)"/);
  assert.ok(style,'style.css must carry a release version');
  assert.ok(script,'boot.js must carry a release version');
  assert.equal(script[1],style[1]);
});

test('app module dependencies carry the same release version',()=>{
  const entry=index.match(/src="boot\.js\?v=([^"]+)"/);
  assert.ok(entry,'boot.js must carry a release version');
  assert.match(boot,new RegExp(`export const RELEASE='${entry[1]}'`));
  assert.match(boot,new RegExp(`app-three\\.js\\?v=${entry[1]}`));
  assert.match(boot,new RegExp(`app\\.js\\?v=${entry[1]}`));
  for(const moduleName of ['graph-model.js','space-scene.js','reader-actions.js']){
    assert.match(app,new RegExp(`from './${moduleName.replace('.', '\\.') }\\?v=${entry[1]}'`),moduleName);
  }
  assert.match(three,new RegExp(`starmap-webgl\\.js\\?v=${entry[1]}`));
  for(const moduleName of ['graph-model.js','space-scene.js'])assert.match(webgl,new RegExp(`${moduleName.replace('.', '\\.')}\\?v=${entry[1]}`));
});
