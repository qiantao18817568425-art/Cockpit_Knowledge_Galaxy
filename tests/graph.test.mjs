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
    assert.ok(['主题目录','主题归类','主题细分','内容索引','课程顺序'].includes(edge.type));
  }
});

test('power management has traceable, detailed learning paths',()=>{
  const branches=graph.nodes.filter(node=>node.kind==='subtopic'&&node.id.startsWith('subtopic:power:'));
  assert.equal(branches.length,graph.meta.subtopicCount);
  assert.equal(graph.meta.powerCategoryCount,branches.filter(node=>node.depth===1).length);
  assert.equal(graph.meta.powerPathCount,branches.filter(node=>node.depth===2).length);
  assert.ok(graph.meta.powerCategoryCount>=10);
  assert.ok(graph.meta.powerPathCount>=20);
  for(const branch of branches){
    assert.ok(branch.url?.startsWith(graph.meta.sourceSite+'architecture/'),branch.id);
    assert.ok(graph.edges.some(edge=>edge.from===branch.parentId&&edge.to===branch.id&&edge.type==='主题细分'),branch.id);
    if(branch.depth===1)assert.equal(branch.parentId,'topic:power',branch.id);
    else assert.ok(branches.some(parent=>parent.id===branch.parentId&&parent.depth===1),branch.id);
    assert.ok(graph.edges.filter(edge=>edge.from===branch.id&&edge.type==='内容索引').length>=2,branch.id);
  }
  const powerTargets=new Set(graph.edges.filter(edge=>edge.from.startsWith('subtopic:power:')).map(edge=>edge.to));
  for(const target of ['chapter:08','chapter:09','chapter:14','chapter:15','chapter:23','chapter:24','course:day-7','course:day-8','course:day-38','course:day-39']){
    assert.ok(powerTargets.has(target),target);
  }
});
