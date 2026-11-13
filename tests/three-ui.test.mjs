import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';

const html=await readFile(new URL('../docs/index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../docs/ui-polish.css',import.meta.url),'utf8');
const app=await readFile(new URL('../docs/app-three.js',import.meta.url),'utf8');
const canvasApp=await readFile(new URL('../docs/app.js',import.meta.url),'utf8');

test('published shell exposes WebGL scene, status, fallback and current reader',()=>{
  for(const id of ['galaxy-three','galaxy','starmap-labels','renderer-status','webgl-retry','canvas-fallback'])assert.match(html,new RegExp(`id="${id}"`));
  for(const id of ['reader-summary','reader-memberships','reader-responsibility','reader-citations','reader-tpm','reader-preview'])assert.match(html,new RegExp(`id="${id}"`));
  assert.equal((html.match(/<script[^>]+type="module"/g)||[]).length,1);
  assert.match(html,/src="boot\.js\?v=/);
  assert.match(html,/id="renderer-status"[^>]*aria-live="polite"/);
});

test('WebGL coordinator connects scene state to current reader and controls',()=>{
  for(const contract of ['createStarmapScene','__GALAXY_BRIDGE__','showNode','clearSelection','galaxy:state','onViewChange','onContextLost','canvas-fallback'])assert.match(app,new RegExp(contract));
  assert.match(css,/#galaxy-three/);
  assert.match(css,/\.starmap-label/);
});

test('desktop shell keeps a compact architecture navigator and reachable deep filters',()=>{
  for(const id of ['quick-constellations','advanced-controls','map-layers','starmap-fullscreen'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/<details id="advanced-controls"/);
  assert.match(html,/class="glass scene-tools"/);
  for(const id of ['platform-filters','path-filters','topic-list','evidence-toggle','sequence-toggle'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(canvasApp,/quick-constellations/);
});

test('published scene uses a real background image and exposes autonomous motion',async()=>{
  const background=await stat(new URL('../docs/assets/galaxy-background-v3.png',import.meta.url));
  assert.ok(background.size>100_000);
  assert.match(html,/class="galaxy-backdrop"/);
  assert.match(css,/url\(['"]?assets\/galaxy-background-v3\.png/);
  assert.ok(html.indexOf('id="motion-toggle"')>html.indexOf('class="glass scene-tools"'));
  assert.ok(html.indexOf('id="motion-toggle"')<html.indexOf('id="hover-card"'));
  assert.match(css,/prefers-reduced-motion:\s*reduce/);
});

test('Canvas fallback keeps motion reachable in a narrow window and lets idle frames stop',()=>{
  assert.match(css,/html\[data-renderer="canvas"\] \.scene-tools\s*\{[^}]*display:flex/);
  assert.match(canvasApp,/function scheduleCanvasFrame\(\)/);
  assert.match(canvasApp,/if\(moving\)scheduleCanvasFrame\(\)/);
});

test('an active WebGL map remains visible if a desktop window becomes narrow',()=>{
  assert.match(css,/html\[data-renderer="three"\] #galaxy-three\s*\{[^}]*display:\s*block/);
  assert.match(css,/html\[data-renderer="three"\] #galaxy\s*\{[^}]*display:\s*none/);
  assert.doesNotMatch(css,/@media \(max-width: 900px\)\s*\{[^}]*#galaxy-three/);
});

test('WebGL motion control is owned by its coordinator and may be explicitly enabled under reduced motion',()=>{
  assert.match(canvasApp,/function startCanvasRenderer\(\)\{if\(!canvasMotionAttached\)\{motionToggle\.addEventListener\('click',handleCanvasMotionToggle\)/);
  assert.match(app,/reducedMotion/);
  assert.doesNotMatch(app,/motionToggle\.disabled=true/);
});
