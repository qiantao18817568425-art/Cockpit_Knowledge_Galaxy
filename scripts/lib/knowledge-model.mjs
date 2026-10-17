import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';

export const EVIDENCE_STATUSES = new Set([
  'confirmed_current',
  'documented_reference',
  'inferred_mapping',
  'conflicting',
  'needs_visual_review'
]);

export const ENTITY_KINDS = new Set([
  'platform','domain','component','interface','state','process',
  'observation','failure_mode','source','evidence'
]);

export const RELATION_TYPES = new Set([
  'belongs_to','runs_on','controls','sends_to','publishes','subscribes',
  'carries_data_to','powers','transitions_to','depends_on','observed_by',
  'fails_as','supported_by','variant_of','conflicts_with','supersedes'
]);

export async function loadKnowledgeContent(contentRoot) {
  const files = (await readdir(contentRoot)).filter(name => name.endsWith('.json')).sort();
  const merged = {sources:[], entities:[], relations:[], evidence:[], claims:[]};
  for (const file of files) {
    const value = JSON.parse(await readFile(path.join(contentRoot, file), 'utf8'));
    for (const key of Object.keys(merged)) merged[key].push(...(value[key] || []));
  }
  return merged;
}

function duplicates(items) {
  const seen = new Set();
  const repeated = new Set();
  for (const item of items) {
    if (!item?.id) continue;
    if (seen.has(item.id)) repeated.add(item.id);
    seen.add(item.id);
  }
  return [...repeated];
}

function validPages(pages) {
  if (!Array.isArray(pages) || pages.length === 0) return false;
  return pages.every(page => {
    if (Number.isInteger(page)) return page > 0;
    return Array.isArray(page) && page.length === 2 && page.every(Number.isInteger) && page[0] > 0 && page[1] >= page[0];
  });
}

export function validateKnowledgeModel(model) {
  const issues = [];
  const sources = model.sources || [];
  const entities = model.entities || [];
  const relations = model.relations || [];
  const evidence = model.evidence || [];
  const claims = model.claims || [];
  for (const id of duplicates(entities)) issues.push(`duplicate entity id: ${id}`);
  for (const id of duplicates(relations)) issues.push(`duplicate relation id: ${id}`);
  for (const id of duplicates(evidence)) issues.push(`duplicate evidence id: ${id}`);
  for (const id of duplicates(claims)) issues.push(`duplicate claim id: ${id}`);

  const sourceIds = new Set(sources.map(item => item.id));
  const entityIds = new Set(entities.map(item => item.id));
  const relationIds = new Set(relations.map(item => item.id));
  const evidenceIds = new Set(evidence.map(item => item.id));

  for (const entity of entities) {
    if (!ENTITY_KINDS.has(entity.kind)) issues.push(`invalid entity kind: ${entity.id} (${entity.kind})`);
  }
  for (const relation of relations) {
    if (!entityIds.has(relation.from) || !entityIds.has(relation.to)) issues.push(`missing endpoint: ${relation.id}`);
    if (!RELATION_TYPES.has(relation.type)) issues.push(`invalid relation type: ${relation.id} (${relation.type})`);
    const platforms = new Set(relation.platforms || []);
    if (platforms.has('MT8668') && platforms.has('MT8676') && relation.scope !== 'shared' && relation.status !== 'conflicting') {
      issues.push(`cross-platform relation requires shared scope: ${relation.id}`);
    }
  }
  for (const item of evidence) {
    if (!sourceIds.has(item.sourceId)) issues.push(`missing source: ${item.id} -> ${item.sourceId}`);
    if (!validPages(item.pages)) issues.push(`invalid pages: ${item.id}`);
    if (!EVIDENCE_STATUSES.has(item.status)) issues.push(`invalid evidence status: ${item.id} (${item.status})`);
    if (!item.summary?.trim()) issues.push(`missing evidence summary: ${item.id}`);
  }
  for (const claim of claims) {
    if (!relationIds.has(claim.relationId)) issues.push(`missing relation: ${claim.id} -> ${claim.relationId}`);
    if (!Array.isArray(claim.evidenceIds) || claim.evidenceIds.length === 0) issues.push(`missing evidence: ${claim.id}`);
    else for (const id of claim.evidenceIds) if (!evidenceIds.has(id)) issues.push(`missing evidence: ${claim.id} -> ${id}`);
    if (!EVIDENCE_STATUSES.has(claim.status)) issues.push(`invalid claim status: ${claim.id} (${claim.status})`);
  }
  return issues;
}

export function compileKnowledgeGraph(model) {
  const issues = validateKnowledgeModel(model);
  if (issues.length) throw new Error(`Knowledge model invalid:\n${issues.join('\n')}`);
  const sourcesById = new Map((model.sources || []).map(source => [source.id, source]));
  const evidenceById = new Map((model.evidence || []).map(item => [item.id, item]));
  const claimsByRelation = new Map();
  for (const claim of model.claims || []) {
    const current = claimsByRelation.get(claim.relationId) || [];
    current.push(claim);
    claimsByRelation.set(claim.relationId, current);
  }
  const nodes = (model.entities || []).map(entity => ({...entity, layer:'knowledge'}));
  for (const source of model.sources || []) {
    nodes.push({...source, title:source.title || source.name, kind:'source', layer:'evidence', hiddenByDefault:true});
  }
  for (const item of model.evidence || []) {
    const source = sourcesById.get(item.sourceId);
    nodes.push({...item, title:item.title || `证据 · ${source?.name || item.sourceId}`, kind:'evidence', layer:'evidence', hiddenByDefault:true,
      sourceName:source?.name, downloadUrl:source?.downloadUrl});
  }
  const edges = (model.relations || []).map(relation => {
    const claims = claimsByRelation.get(relation.id) || [];
    return {...relation, layer:'knowledge', claims};
  });
  for (const claim of model.claims || []) {
    const relation = (model.relations || []).find(item => item.id === claim.relationId);
    for (const evidenceId of claim.evidenceIds || []) {
      edges.push({id:`support:${claim.id}:${evidenceId}`,from:relation.from,to:evidenceId,type:'supported_by',pathClass:'diagnostic',layer:'evidence',hiddenByDefault:true,claimId:claim.id});
    }
  }
  for (const item of model.evidence || []) {
    if (evidenceById.has(item.id)) edges.push({id:`source:${item.id}`,from:item.id,to:item.sourceId,type:'supported_by',pathClass:'diagnostic',layer:'evidence',hiddenByDefault:true});
  }
  return {nodes, edges, meta:{entityCount:(model.entities || []).length, relationCount:(model.relations || []).length,
    evidenceCount:(model.evidence || []).length, sourceCount:(model.sources || []).length, claimCount:(model.claims || []).length}};
}

