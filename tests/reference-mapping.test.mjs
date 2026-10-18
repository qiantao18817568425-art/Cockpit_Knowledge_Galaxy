import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const readJson=async relative=>JSON.parse(await readFile(new URL(relative,import.meta.url),'utf8'));
const graph=await readJson('../docs/graph.json');
const byId=new Map(graph.nodes.map(node=>[node.id,node]));

function assertConcreteTarget(id,owner){
  const node=byId.get(id);
  assert.ok(node,`${owner}: missing ${id}`);
  assert.ok(node.hierarchyLevel>=2,`${owner}: ${id} must target L3/L4, got ${node.hierarchyLevel}`);
  assert.notEqual(node.kind,'architecture_dimension',`${owner}: ${id}`);
}

test('every Day and Week maps explicitly to concrete architecture knowledge',async()=>{
  const mapping=await readJson('../content/learning-mapping.json');
  const learningNodes=graph.nodes.filter(node=>['lesson','review'].includes(node.kind));
  assert.equal(mapping.items.length,learningNodes.length);
  assert.equal(new Set(mapping.items.map(item=>item.id)).size,mapping.items.length);
  for(const node of learningNodes){
    const item=mapping.items.find(candidate=>candidate.id===node.id);
    assert.ok(item,node.id);
    assert.ok(item.knowledgeIds.length,node.id);
    assert.ok(item.basis?.trim(),node.id);
    for(const id of item.knowledgeIds)assertConcreteTarget(id,node.id);
  }
});

test('all 21 T12T skills map to applicable L3 or L4 knowledge',async()=>{
  const mapping=await readJson('../content/skill-mapping.json');
  assert.equal(mapping.skills.length,21);
  assert.equal(new Set(mapping.skills.map(item=>item.id)).size,21);
  for(const skill of mapping.skills){
    assert.ok(skill.knowledgeIds.length,skill.id);
    for(const id of skill.knowledgeIds)assertConcreteTarget(id,skill.id);
  }
});

test('all public sources use evidence-bounded concrete mappings',async()=>{
  const register=await readJson('../content/source-register.json');
  assert.equal(register.documents.length,299);
  for(const source of register.documents){
    assert.ok(source.knowledgeMappings?.length,source.id);
    for(const mapping of source.knowledgeMappings){
      assertConcreteTarget(mapping.knowledgeId,source.id);
      assert.ok(mapping.basis?.trim(),source.id);
      assert.ok(['indexed','needs_review','page_verified','case_verified'].includes(mapping.status),`${source.id}: ${mapping.status}`);
      if(mapping.status==='page_verified')assert.ok(mapping.pages?.length,source.id);
    }
  }
});

test('sanitized cases declare evidence state and never publish local raw paths',async()=>{
  const register=await readJson('../content/case-register.json');
  assert.ok(register.cases.length>0);
  assert.ok(!JSON.stringify(register).includes('I:\\T29-8678\\日志'));
  for(const item of register.cases){
    assert.ok(item.id&&item.symptom&&item.publicSummary,item.id);
    assert.ok(['indexed','aligned','verified','concluded','needs_review'].includes(item.evidenceState),item.id);
    assert.ok(item.knowledgeIds.length,item.id);
    assert.ok(item.skillIds.length,item.id);
    for(const id of item.knowledgeIds)assertConcreteTarget(id,item.id);
  }
});

test('compiled L3 nodes embed references or declare an explicit review gap',()=>{
  for(const node of graph.nodes.filter(item=>item.kind==='architecture_chain')){
    const count=(node.dayIds?.length||0)+(node.sourceClaims?.length||0)+(node.skillIds?.length||0)+(node.caseIds?.length||0);
    assert.ok(count>0||node.referenceState==='awaiting_review',node.id);
  }
  assert.equal(graph.nodes.some(node=>node.id==='chain:tpm-closure'),false);
  assert.equal(graph.nodes.some(node=>node.kind==='architecture_chain'&&/TPM.*闭环/.test(node.title)),false);
});
