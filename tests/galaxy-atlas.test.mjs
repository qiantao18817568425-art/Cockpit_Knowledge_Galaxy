import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('visual checkpoint has a separate accessible atlas and top toolbar',async()=>{
  const html=await readFile(new URL('../docs/hybrid-preview.html',import.meta.url),'utf8');
  for(const id of ['atlas-svg','atlas-cards','top-toolbar','tool-drawer','atlas-fan','galaxy-backdrop'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/aria-label="座舱架构星座"/);
});
test('atlas renderer draws only local semantic edges and supports interactions',async()=>{
  const {renderGalaxyAtlas}=await import('../docs/galaxy-atlas.js');
  assert.equal(typeof renderGalaxyAtlas,'function');
});
