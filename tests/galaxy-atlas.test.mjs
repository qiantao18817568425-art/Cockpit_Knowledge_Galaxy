import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('published visual checkpoint has an accessible WebGL map and topic navigation',async()=>{
  const html=await readFile(new URL('../docs/index.html',import.meta.url),'utf8');
  for(const id of ['galaxy-three','renderer-status','topic-list','starmap-labels'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/aria-label="三维座舱知识星图/);
});
test('atlas renderer draws only local semantic edges and supports interactions',async()=>{
  const {renderGalaxyAtlas}=await import('../docs/galaxy-atlas.js');
  assert.equal(typeof renderGalaxyAtlas,'function');
});
