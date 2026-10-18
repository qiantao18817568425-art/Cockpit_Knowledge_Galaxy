import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildReaderModel,readerMarkdown} from '../docs/graph-model.js';

const graph=JSON.parse(await readFile(new URL('../docs/graph.json',import.meta.url),'utf8'));
const dimensions=graph.nodes.filter(node=>node.kind==='architecture_dimension');

test('all 17 architecture dimensions contain absorbed responsibility architecture and source notes',()=>{
  assert.equal(dimensions.length,17);
  for(const node of dimensions){
    assert.equal(node.contentState,'absorbed',node.id);
    assert.ok(node.summary?.length>=20,node.id);
    assert.ok(node.knowledge?.role,node.id);
    assert.ok(node.knowledge?.input?.length,node.id);
    assert.ok(node.knowledge?.mechanism?.length,node.id);
    assert.ok(node.knowledge?.output?.length,node.id);
    assert.ok(node.knowledge?.observations?.length,node.id);
    assert.ok(node.architecture?.length>=5,node.id);
    assert.ok(node.sourceClaims?.length,node.id);
    assert.ok(node.sourceClaims.some(item=>['page_verified','supporting_context'].includes(item.status)&&item.pages?.length&&item.claim&&item.basis),node.id);
  }
});

test('camera dimension explains MT8668 MT8676 common path and keeps version boundaries',()=>{
  const model=buildReaderModel(graph,'architecture:camera-perception');
  assert.equal(model.contentState,'absorbed');
  assert.match(model.summary,/控制面和帧数据面/);
  assert.ok(model.sourceClaims.some(item=>item.platform==='MT8668'&&item.pages.includes(6)));
  assert.ok(model.sourceClaims.some(item=>item.platform==='MT8676'&&item.pages.includes(8)));
  assert.match(model.responsibility.limits.join(' '),/相通/);
  assert.match(readerMarkdown(model),/```mermaid/);
  assert.match(readerMarkdown(model),/学习批注/);
});

test('all public hierarchy readers are free from placeholder absorption text',()=>{
  for(const node of graph.nodes.filter(node=>Number.isInteger(node.hierarchyLevel)&&node.hierarchyLevel<=4&&!node.navigationOnly)){
    const model=buildReaderModel(graph,node.id);
    assert.notEqual(model.contentState,'awaiting_absorption',node.id);
    assert.notEqual(model.responsibility.role,'资料尚未吸收',node.id);
  }
});

test('cross-dimension relations explain why they connect and how to verify them',()=>{
  const relations=graph.edges.filter(edge=>edge.layer==='architecture_relation');
  assert.ok(relations.length>=18);
  for(const edge of relations){
    assert.ok(edge.why?.length>=20,edge.id);
    assert.ok(edge.input,edge.id);
    assert.ok(edge.handoff,edge.id);
    assert.ok(edge.output,edge.id);
    assert.ok(edge.verification,edge.id);
    assert.ok(edge.evidenceBasis,edge.id);
  }
});

test('display and touch manuals are decomposed into technical L3 and L4 nodes',()=>{
  const ids=['component:display-ovl-cmdq','interface:virtual-display-connector','component:dsi-panel-chain','component:touch-controller-driver','interface:virtio-input-touch','component:android-input-framework','observation:dsi-pattern-cut','observation:touch-dual-getevent'];
  for(const id of ids){
    const node=graph.nodes.find(item=>item.id===id);
    assert.ok(node,id);
    assert.equal(node.contentState,'absorbed',id);
    assert.ok(node.knowledge?.role&&node.knowledge?.observations?.length,id);
    assert.ok(node.hierarchyLevel>=3&&node.hierarchyLevel<=5,id);
  }
  const display=buildReaderModel(graph,'chain:display-output');
  assert.ok(display.children.some(item=>item.id==='component:android-display'));
  assert.equal(display.children.some(item=>item.kind==='source'),false);
  const touch=buildReaderModel(graph,'interface:virtio-input-touch');
  assert.ok(touch.citations.some(item=>item.sourceName==='MT8676_Hypervisor_Touch_User_Manual_V1.1.pdf'&&item.pages.includes(7)));
});
