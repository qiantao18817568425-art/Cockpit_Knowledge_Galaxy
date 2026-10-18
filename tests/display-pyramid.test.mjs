import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const graph=JSON.parse(await readFile(new URL('../docs/graph.json',import.meta.url),'utf8'));
const byId=new Map(graph.nodes.map(node=>[node.id,node]));
const relation=id=>graph.edges.find(edge=>edge.id===id);
function pathTitles(id){
  const result=[];const seen=new Set();let node=byId.get(id);
  while(node&&!seen.has(node.id)){result.push(node.title);seen.add(node.id);node=byId.get(node.primaryParentId);}
  return result.reverse();
}

test('physical display follows the approved L0-L4 drill path',()=>{
  assert.deepEqual(pathTitles('component:physical-display'),[
    '智能座舱','Android、HMI 与显示','显示输出链','物理屏 / SerDes'
  ]);
  assert.equal(byId.get('component:physical-display').hierarchyLevel,3);
});

test('display data, backlight control and diagnosis remain separate',()=>{
  const displayToHost=relation('rel:hmi:001');
  const hostToPanel=relation('rel:hmi:002');
  const backlight=relation('rel:hmi:003');
  const firstFrame=relation('rel:hmi:005');
  assert.equal(displayToHost.pathClass,'data');
  assert.match(displayToHost.why,/合成|提交|显示数据/);
  assert.deepEqual(displayToHost.claims[0].evidenceIds,['ev:hmi:001']);
  assert.deepEqual(hostToPanel.claims[0].evidenceIds,['ev:hmi:002']);
  assert.ok(['control','power'].includes(backlight.pathClass));
  assert.equal(firstFrame.pathClass,'diagnostic');
  for(const edge of [displayToHost,hostToPanel,backlight,firstFrame]){
    assert.ok(edge.input&&edge.handoff&&edge.output,edge.id);
    assert.ok(edge.verification?.length,edge.id);
  }
});

test('physical display explains responsibility, observations and evidence limits',()=>{
  const node=byId.get('component:physical-display');
  assert.ok(node.knowledge.role&&node.knowledge.role!==node.title);
  assert.ok(node.knowledge.input.length);
  assert.ok(node.knowledge.output.length);
  assert.ok(node.knowledge.observations.length);
  assert.ok(node.knowledge.limits.some(value=>/未知|接线|版本|待确认/.test(value)));
  assert.ok(graph.nodes.some(item=>item.primaryParentId===node.id&&item.hierarchyLevel===4));
});
