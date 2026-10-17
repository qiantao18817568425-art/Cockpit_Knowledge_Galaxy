import test from 'node:test';
import assert from 'node:assert/strict';
import {markdownDownloadSpec,referenceAction} from '../docs/reader-actions.js';

test('PDF references can be loaded in place and downloaded',()=>{
  const action=referenceAction('https://example.com/raw-files/manual.pdf');
  assert.equal(action.previewType,'pdf');
  assert.equal(action.canLoad,true);
  assert.equal(action.canDownload,true);
});

test('article references load in place and keep an external fallback',()=>{
  const action=referenceAction('https://example.com/architecture/14.html#power');
  assert.equal(action.previewType,'article');
  assert.equal(action.canLoad,true);
  assert.equal(action.canDownload,false);
  assert.equal(action.externalUrl,'https://example.com/architecture/14.html#power');
});

test('markdown download uses a safe topic filename and UTF-8 content',()=>{
  const spec=markdownDownloadSpec('电源/休眠：STR','## 内容');
  assert.equal(spec.filename,'电源-休眠-STR-专题总结.md');
  assert.equal(spec.type,'text/markdown;charset=utf-8');
  assert.equal(spec.content,'## 内容');
});

