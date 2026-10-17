import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../docs/style.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');

test('topic reader exposes synthesis, citations, preview and download actions',()=>{
  for(const id of ['reader-summary','reader-insights','reader-citations','reader-preview','reader-download-summary'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/专题总结/);
  assert.match(html,/正常技术链/);
  assert.match(html,/引用资料与文章/);
  assert.match(html,/为什么有关/);
  assert.match(html,/为什么引用/);
});

test('pyramid reader exposes ordered drill sections and folded navigation',()=>{
  for(const id of ['reader-breadcrumb','reader-responsibility','reader-children','reader-paths','reader-observations','reader-citations','reader-navigation'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/<details[^>]*id="reader-navigation"/);
});

test('topic reader is full screen on narrow mobile layouts',()=>{
  assert.match(css,/@media\(max-width:720px\)[\s\S]*\.detail\{[^}]*inset:0/);
  assert.match(css,/@media\(max-width:720px\)[\s\S]*\.detail\{[^}]*position:fixed/);
  assert.match(css,/@media\(max-width:720px\)[\s\S]*\.reader-breadcrumb\{[^}]*overflow-x:auto/);
  assert.match(css,/@media\(max-width:720px\)[\s\S]*\.drill-card\{[^}]*width:100%/);
});

test('topic reader app supports inline loading and markdown export',()=>{
  assert.match(app,/buildReaderModel/);
  assert.match(app,/readerMarkdown/);
  assert.match(app,/showReference/);
  assert.match(app,/downloadReaderSummary/);
  assert.match(app,/whyRelated/);
  assert.match(app,/whyCited/);
  assert.match(app,/evidenceBoundary/);
});

test('path controls expose state flow separately and explain edge semantics',()=>{
  for(const path of ['control','data','power','state','diagnostic'])assert.match(html,new RegExp(`data-path="${path}"`));
  assert.match(html,/层级线用于下钻/);
  assert.match(html,/技术线按控制、数据、电源、状态和诊断分色/);
});
test('technical path cards expose relation verification points',()=>{
 assert.match(app,/\['验证',\(item\.verification/);
});
test('reader receives the active platform filter',()=>{
 assert.match(app,/buildReaderModel\(graph,id,\{platforms:viewState\.platforms\}\)/);
});

test('citation count tracks actual reference cards rather than the empty placeholder',()=>{
  assert.match(app,/let citationCount=0/);
  assert.match(app,/citationCount\+\+/);
  assert.match(app,/`\$\{citationCount\} 项`/);
});

test('inline preview scrolls only the detail panel and never shifts the whole page',()=>{
  assert.match(app,/detail\.scrollTo\(/);
  assert.doesNotMatch(app,/section\.scrollIntoView/);
});
