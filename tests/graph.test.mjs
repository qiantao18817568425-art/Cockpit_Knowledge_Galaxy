import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const graph = JSON.parse(await readFile(new URL('../docs/graph.json', import.meta.url),'utf8'));
const ids = new Set(graph.nodes.map(n=>n.id));

test('public learning content is complete and traceable',()=>{
  assert.ok(graph.nodes.filter(n=>n.kind==='chapter').length>=25);
  assert.ok(graph.nodes.filter(n=>n.kind==='lesson').length>=44);
  assert.ok(graph.nodes.filter(n=>n.kind==='review').length>=23);
  assert.equal(graph.meta.chapterCount,graph.nodes.filter(n=>n.kind==='chapter').length);
  assert.equal(graph.meta.lessonCount,graph.nodes.filter(n=>n.kind==='lesson').length);
  assert.equal(graph.meta.reviewCount,graph.nodes.filter(n=>n.kind==='review').length);
  for(const node of graph.nodes.filter(n=>['chapter','lesson','review'].includes(n.kind))) {
    assert.ok(node.url?.startsWith(graph.meta.sourceSite),node.id);
  }
});

test('every edge resolves and states an index relation',()=>{
  assert.equal(ids.size,graph.nodes.length);
  for(const edge of graph.edges){
    assert.ok(ids.has(edge.from),edge.from);
    assert.ok(ids.has(edge.to),edge.to);
    assert.ok(['主题目录','主题归类','课程顺序'].includes(edge.type));
  }
});

