import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const register=JSON.parse(await readFile(new URL('../content/source-register.json',import.meta.url),'utf8'));

test('public source register covers all deduplicated public documents',()=>{
  assert.equal(register.documents.length,299);
  assert.equal(register.summary.publicDocuments,299);
  assert.equal(new Set(register.documents.map(x=>x.id)).size,299);
  assert.equal(new Set(register.documents.map(x=>x.sha256)).size,299);
  for(const item of register.documents){
    assert.match(item.sha256,/^[0-9a-f]{64}$/); assert.match(item.downloadUrl,/^https:\/\//);
    assert.ok(item.processingState); assert.ok(item.knowledgeIds.length||['container_indexed','needs_visual_review','metadata_only','superseded_duplicate','out_of_scope_support_file'].includes(item.processingState),item.id);
  }
  assert.ok(register.archiveDocuments.length>=49);
  assert.ok(!JSON.stringify(register).includes('I:\\'));
  assert.ok(!register.documents.some(x=>/Thumbs\.db/i.test(x.name)));
});

