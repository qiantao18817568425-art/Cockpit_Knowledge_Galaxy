import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  applyHierarchy,
  breadcrumbIds,
  buildHierarchyEdges,
  loadHierarchy,
  validateHierarchy
} from '../scripts/lib/hierarchy-model.mjs';

const fixture=async name=>JSON.parse(await readFile(new URL(`fixtures/${name}`,import.meta.url),'utf8'));

test('valid hierarchy has a single continuous root path',async()=>{
  const {nodes}=await fixture('hierarchy-valid.json');
  assert.deepEqual(validateHierarchy(nodes,{rootId:'root'}),[]);
  assert.deepEqual(breadcrumbIds(nodes,'component:physical-display'),[
    'root','pyramid:functional','domain:display','chain:display-output','component:physical-display'
  ]);
  const edges=buildHierarchyEdges(nodes);
  assert.equal(edges.length,nodes.length-1);
  assert.ok(edges.every(edge=>edge.type==='primary_contains'&&edge.pathClass==='hierarchy'&&edge.layer==='hierarchy'));
});

test('invalid hierarchy reports every structural failure',async()=>{
  const {nodes}=await fixture('hierarchy-invalid.json');
  const issues=validateHierarchy(nodes,{rootId:'root'});
  for(const fragment of ['missing parent','cycle','level gap','unreachable','multiple assignment']){
    assert.ok(issues.some(issue=>issue.includes(fragment)),`${fragment}: ${issues.join(' | ')}`);
  }
});

test('hierarchy application preserves explicit assignments and applies exact fallbacks',async()=>{
  const hierarchy=await loadHierarchy(new URL('../content/hierarchy.json',import.meta.url));
  const input=[
    {id:'root',title:'座舱知识',kind:'root'},
    {id:'chapter:01',title:'章节',kind:'chapter'},
    {id:'course:day-1',title:'课程',kind:'lesson'},
    {id:'subtopic:raw:display',title:'显示资料',kind:'subtopic',parentId:'topic:raw'},
    {id:'source-a',title:'资料',kind:'source',category:'display'},
    {id:'ev-a',title:'证据',kind:'evidence',sourceId:'source-a'},
    {id:'domain:display',title:'显示与触控',kind:'domain',domain:'display'},
    {id:'component:generic-display-test',title:'通用显示组件',kind:'component',domain:'display'}
  ];
  const applied=applyHierarchy(input,hierarchy);
  const byId=new Map(applied.map(node=>[node.id,node]));
  assert.equal(byId.get('chapter:01').primaryParentId,'pyramid:course:chapters');
  assert.equal(byId.get('course:day-1').primaryParentId,'pyramid:course:lessons');
  assert.equal(byId.get('source-a').primaryParentId,'subtopic:raw:display');
  assert.equal(byId.get('ev-a').primaryParentId,'source-a');
  assert.equal(byId.get('component:generic-display-test').primaryParentId,'domain:display');
});
