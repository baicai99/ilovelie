import { CommentDetector } from './commentDetector';

const detector = new CommentDetector();

export function normalizeComment(text: string): string {
    const content = detector.extractCommentContent(text, '');
    return content.replace(/\s+/g, '').toLowerCase();
}
