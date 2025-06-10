import * as assert from 'assert';
import { CommentDetector } from '../comment/commentDetector';

describe('CommentDetector', () => {
  const detector = new CommentDetector();

  it('detects html comment format', () => {
    const format = detector.getCommentFormat('<!-- hello -->', 'html');
    assert.strictEqual(format, 'html-comment');
  });

  it('replaces html comment content', () => {
    const result = detector.replaceCommentContent('<!-- old -->', 'new', 'html');
    assert.strictEqual(result, '<!-- new -->');
  });
});
