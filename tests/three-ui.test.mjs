import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../docs/index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../docs/style.css',import.meta.url),'utf8');
const app=await readFile(new URL('../docs/app.js',import.meta.url),'utf8');

test('restored page starts the original canvas and keeps knowledge controls',()=>{
  for(const id of ['galaxy','search','platform-filters','path-filters','evidence-toggle','sequence-toggle','motion-toggle','detail']){
    assert.match(html,new RegExp(`id="${id}"`));
  }
  for(const id of ['reader-summary','reader-memberships','reader-responsibility','reader-citations','reader-tpm','reader-preview']){
    assert.match(html,new RegExp(`id="${id}"`));
  }
  assert.match(html,/src="app\.js\?v=/);
  assert.doesNotMatch(html,/id="galaxy-three"|src="boot\.js\?v=|class="galaxy-backdrop"/);
});

test('restored canvas retains drag, zoom, search and motion controls',()=>{
  for(const event of ['pointerdown','pointermove','pointerup','wheel']){
    assert.match(app,new RegExp(`canvas\\.addEventListener\\('${event}'`));
  }
  assert.match(app,/search\.addEventListener\('input'/);
  assert.match(app,/motionToggle\.addEventListener\('click'/);
  assert.match(css,/\.controls\{/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
