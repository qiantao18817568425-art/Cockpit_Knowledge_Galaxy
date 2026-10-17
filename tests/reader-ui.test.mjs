import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../docs/style.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');

test('topic reader exposes synthesis, citations, preview and download actions',()=>{
  for(const id of ['reader-summary','reader-insights','reader-citations','reader-preview','reader-download-summary'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/专题总结/);
  assert.match(html,/衍生理解/);
  assert.match(html,/引用资料与文章/);
});

test('topic reader is full screen on narrow mobile layouts',()=>{
  assert.match(css,/@media\(max-width:720px\)[\s\S]*\.detail\{[^}]*inset:0/);
});

test('topic reader app supports inline loading and markdown export',()=>{
  assert.match(app,/buildReaderModel/);
  assert.match(app,/readerMarkdown/);
  assert.match(app,/showReference/);
  assert.match(app,/downloadReaderSummary/);
});

