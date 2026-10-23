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

test('Day 45 through Week 15 Friday join diagnosis and OTA knowledge chains with explicit course links',async()=>{
  const mapping=await readJson('../content/learning-mapping.json');
  const expected={
    'course:day-45':['chain:evidence-ledger','chain:stability'],
    'course:day-46':['chain:evidence-ledger','chain:ethernet-connectivity'],
    'course:day-47':['chain:ota-lifecycle','chain:boot-lifecycle','chain:power-lifecycle','chain:evidence-ledger'],
    'course:day-48':['chain:ota-lifecycle','chain:runtime-boundaries','chain:tee-security','chain:evidence-ledger'],
    'course:week-15-friday':['chain:ota-lifecycle','chain:evidence-ledger','chain:ethernet-connectivity','chain:tee-security']
  };
  for(const [courseId,knowledgeIds] of Object.entries(expected)){
    const item=mapping.items.find(candidate=>candidate.id===courseId);
    assert.ok(item,courseId);
    assert.deepEqual(item.knowledgeIds,knowledgeIds,courseId);
    assert.ok(item.basis?.includes('课程发布状态不代表已经掌握'),courseId);
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
      assert.ok(['indexed','content_indexed','needs_review','page_verified','case_verified'].includes(mapping.status),`${source.id}: ${mapping.status}`);
      if(mapping.status==='page_verified')assert.ok(mapping.pages?.length,source.id);
    }
  }
});

test('raw documents stay in the evidence catalogue rather than the knowledge pyramid',()=>{
  const sources=graph.nodes.filter(node=>node.kind==='source');
  assert.equal(sources.length,299);
  for(const source of sources){
    assert.match(source.primaryParentId,/^subtopic:raw:/,source.id);
    assert.equal(source.navigationOnly,true,source.id);
  }
  const technicalParents=new Set(graph.nodes.filter(node=>!node.navigationOnly&&node.kind!=='source').map(node=>node.id));
  assert.equal(sources.some(source=>technicalParents.has(source.primaryParentId)),false);
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

test('reviewed reports use canonical cases, revision chains and per-node projections',async()=>{
  const register=await readJson('../content/case-register.json');
  const audio=register.cases.find(item=>item.id==='case:mt8676-driving-mode-audio-loop');
  const flashing=register.cases.find(item=>item.id==='case:mtk-flash-boot-a-transport-collapse');
  assert.equal(audio.caseStatus,'root_cause_confirmed');
  assert.equal(audio.reportVersions.length,2);
  assert.equal(audio.reportVersions[1].supersedes,audio.reportVersions[0].id);
  assert.ok(audio.projections.some(item=>item.knowledgeId==='chain:vehicle-bus'&&item.relationReason));
  assert.ok(audio.projections.some(item=>item.knowledgeId==='chain:audio-policy-routing'&&item.role==='downstream_effect'));
  assert.equal(flashing.caseStatus,'direct_failure_confirmed_trigger_open');
  assert.ok(flashing.evidence.some(item=>item.type==='missing'));
  assert.ok(flashing.projections.every(item=>item.summary&&item.relationReason&&item.tpmFocus));
  for(const report of [...audio.reportVersions,...flashing.reportVersions]){
    const url=new URL(`../docs/${report.url}`,import.meta.url);
    assert.ok((await readFile(url,'utf8')).length>1000,report.url);
  }
});

test('case projections roll up from L3 chains to their L2 architecture dimensions',()=>{
  const vehicleBus=byId.get('chain:vehicle-bus');
  const canEthernet=byId.get('architecture:can-ethernet');
  const audio=byId.get('architecture:audio');
  assert.ok(vehicleBus.cases.some(item=>item.id==='case:mt8676-driving-mode-audio-loop'&&item.projection.role==='root_cause'));
  assert.ok(canEthernet.cases.some(item=>item.id==='case:mt8676-driving-mode-audio-loop'&&item.projectionKnowledgeId==='chain:vehicle-bus'));
  assert.ok(audio.cases.some(item=>item.id==='case:mt8676-driving-mode-audio-loop'&&item.projection.role==='downstream_effect'));
});

test('compiled L3 nodes embed references or declare an explicit review gap',()=>{
  for(const node of graph.nodes.filter(item=>item.kind==='architecture_chain')){
    const count=(node.dayIds?.length||0)+(node.sourceClaims?.length||0)+(node.skillIds?.length||0)+(node.caseIds?.length||0);
    assert.ok(count>0||node.referenceState==='awaiting_review',node.id);
  }
  assert.equal(graph.nodes.some(node=>node.id==='chain:tpm-closure'),false);
  assert.equal(graph.nodes.some(node=>node.kind==='architecture_chain'&&/TPM.*闭环/.test(node.title)),false);
});
