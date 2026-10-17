import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateKnowledgeModel,compileKnowledgeGraph} from '../scripts/lib/knowledge-model.mjs';

const load=async name=>JSON.parse(await readFile(new URL(`fixtures/${name}`,import.meta.url),'utf8'));

test('valid evidence knowledge model compiles without issues',async()=>{
  const model=await load('knowledge-model-valid.json');
  assert.deepEqual(validateKnowledgeModel(model),[]);
  const graph=compileKnowledgeGraph(model);
  assert.equal(graph.nodes.filter(node=>node.kind==='source').length,1);
  assert.equal(graph.nodes.filter(node=>node.kind==='evidence').length,1);
  assert.ok(graph.edges.some(edge=>edge.type==='supported_by'));
});

test('invalid model reports structural and evidence errors',async()=>{
  const issues=validateKnowledgeModel(await load('knowledge-model-invalid.json'));
  for(const fragment of ['duplicate entity id','missing endpoint','missing relation','missing evidence','missing source','invalid pages','invalid evidence status','cross-platform relation']){
    assert.ok(issues.some(issue=>issue.includes(fragment)),fragment);
  }
});

test('documented claims cannot cover a platform absent from their evidence',async()=>{
  const model=await load('knowledge-model-valid.json');
  model.sources[0].platform='MT8676';
  model.evidence[0].platforms=['MT8676'];
  model.relations[0].platforms=['MT8668','MT8676'];
  model.relations[0].scope='shared';
  model.claims[0].platforms=['MT8668','MT8676'];
  const issues=validateKnowledgeModel(model);
  assert.ok(issues.some(issue=>issue.includes('documented claim platform lacks evidence')&&issue.includes('MT8668')));
});
