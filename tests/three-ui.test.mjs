import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../docs/index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../docs/style.css',import.meta.url),'utf8');
const app=await readFile(new URL('../docs/app-three.js',import.meta.url),'utf8').catch(()=> '');

test('new shell adds constellation controls without dropping reader contracts',()=>{
  for(const id of ['relation-mode','constellation-cards','fan-list','renderer-status','webgl-retry','canvas-fallback','galaxy-three'])assert.match(html,new RegExp(`id="${id}"`));
  for(const id of ['reader-summary','reader-memberships','reader-responsibility','reader-citations','reader-tpm','reader-preview'])assert.match(html,new RegExp(`id="${id}"`));
  assert.equal((html.match(/<script[^>]+type="module"/g)||[]).length,1);
  assert.match(html,/src="boot\.js\?v=/);
});

test('fan list is semantic, focusable and exposes long-list behavior',()=>{
  assert.match(html,/<ol[^>]+id="fan-list"/);
  assert.match(app,/fan-list/);
  assert.match(app,/tabIndex\s*=\s*0/);
  assert.match(app,/event\.key==='Enter'\|\|event\.key===' '/);
  assert.match(app,/requiresScroll/);
  assert.match(app,/for\(const item of layout\.listItems\)/);
  assert.match(css,/\.fan-list\.is-scrollable/);
});

test('three coordinator keeps state flow and legacy knowledge reader bridge',()=>{
  assert.match(app,/createGalaxyState/);
  assert.match(app,/reduceGalaxyState/);
  assert.match(app,/createGalaxyScene/);
  assert.match(app,/buildDrillLayout/);
  assert.match(app,/__GALAXY_LEGACY__/);
  assert.match(app,/startThreeApp/);
  assert.match(app,/await startThreeApp\(\)/);
  assert.match(app,/galaxy:search/);
});

test('mobile and reduced motion keep navigation usable',()=>{
  assert.match(css,/@media\(max-width:720px\)[\s\S]*\.fan-panel/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(html,/aria-label="切换架构层级与技术关系"/);
  assert.match(html,/aria-live="polite"[^>]*id="renderer-status"|id="renderer-status"[^>]*aria-live="polite"/);
});
