import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../docs/style.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');

test('topic reader exposes synthesis, citations, preview and download actions',()=>{
  for(const id of ['reader-summary','reader-insights','reader-citations','reader-preview','reader-download-summary'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/专题总结/);
  assert.match(html,/技术关系及关联原因/);
  assert.match(html,/原始资料与证据/);
  assert.match(html,/为什么有关/);
  assert.match(html,/为什么引用/);
});

test('pyramid reader exposes ordered drill sections and folded navigation',()=>{
  for(const id of ['reader-breadcrumb','reader-memberships','reader-responsibility','reader-children','reader-learning','reader-analysis','reader-cases','reader-paths','reader-case-relations','reader-case-evidence','reader-source-mappings','reader-citations','reader-tpm','reader-verification','reader-observations','reader-navigation'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/<details[^>]*id="reader-navigation"/);
  for(const heading of ['本层架构','课程','分析','历史日志案例','技术关系及关联原因','原始资料与证据','TPM责任与验证关闭'])assert.match(html,new RegExp(heading));
});

test('reader renders all evidence and responsibility dimensions from the model',()=>{
  for(const field of ['model.memberships','model.courses','model.analysis','model.cases','model.sourceClaims','model.tpm','model.verification'])assert.match(app,new RegExp(field.replace('.','\\.')));
  assert.match(app,/主要归属/);
  assert.match(app,/同时关联/);
  assert.match(app,/首轮牵头/);
  assert.match(app,/关闭判据/);
  assert.match(app,/映射理由/);
});

test('desktop reader is wide and legible while mobile text stays readable',()=>{
  assert.match(css,/\.detail\{[^}]*width:clamp\(580px,42vw,700px\)/);
  assert.match(css,/\.detail h2\{[^}]*font-size:24px/);
  assert.match(css,/\.reader-heading h3\{[^}]*font-size:16px/);
  assert.match(css,/\.detail p\{[^}]*font-size:14px/);
  assert.match(css,/@media\(max-width:720px\)[\s\S]*\.detail p\{[^}]*font-size:15px/);
});

test('topic reader is full screen on narrow mobile layouts',()=>{
  assert.match(css,/@media\(max-width:720px\)[\s\S]*\.detail\{[^}]*inset:0/);
  assert.match(css,/@media\(max-width:720px\)[\s\S]*\.detail\{[^}]*position:fixed/);
  assert.match(css,/@media\(max-width:720px\)[\s\S]*\.reader-breadcrumb\{[^}]*overflow-x:auto/);
  assert.match(css,/@media\(max-width:720px\)[\s\S]*\.drill-card\{[^}]*width:100%/);
});

test('long source filenames wrap instead of widening the mobile reader',()=>{
  assert.match(css,/\.citation-card\{[^}]*min-width:0/);
  assert.match(css,/\.citation-card>header strong,\.source-mapping-card>header strong\{[^}]*overflow-wrap:anywhere/);
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
