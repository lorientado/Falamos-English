import { AnswerCheckResult, VocabItem } from '../types';

export function normalizeEnglish(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/g, '');
}

export function stripLeadingArticle(input: string): { article: string | null; body: string } {
  const norm = normalizeEnglish(input);
  const match = norm.match(/^(a|an|the|some)\s+(.+)$/i);
  if (!match) {
    return { article: null, body: norm };
  }
  return { article: match[1].toLowerCase(), body: match[2].trim() };
}

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function checkEnglishWordAnswer(
  rawInput: string,
  target: Pick<VocabItem, 'word' | 'article' | 'variants'>,
  otherWords: string[] = []
): AnswerCheckResult {
  const { article: typedArticle, body } = stripLeadingArticle(rawInput);
  const expectedBody = normalizeEnglish(target.word);
  const expectedDisplay =
    target.article && target.article !== '-' ? `${target.article} ${target.word}` : target.word;

  if (!body) {
    return { kind: 'wrong', accepted: false, expected: expectedDisplay };
  }

  const variants = (target.variants ?? []).map((v) => normalizeEnglish(v));
  const matchesTarget = body === expectedBody;
  const matchesVariant = variants.includes(body);

  if (matchesTarget) {
    if (
      typedArticle &&
      target.article &&
      target.article !== '-' &&
      typedArticle !== target.article.toLowerCase() &&
      !(target.article === 'some' && typedArticle === 'the')
    ) {
      return {
        kind: 'article',
        accepted: true,
        expected: expectedDisplay,
        noteGl: `A palabra é correcta, pero o artigo habitual é «${target.article} ${target.word}».`,
      };
    }
    return { kind: 'exact', accepted: true, expected: expectedDisplay };
  }

  if (matchesVariant) {
    return {
      kind: 'variant',
      accepted: true,
      expected: expectedDisplay,
      noteGl: `Tamén é válida esa variante! Aquí traballamos especialmente «${target.word}».`,
    };
  }

  // Check if user wrote another word from the curriculum
  const normalizedOthers = otherWords
    .map((w) => normalizeEnglish(w))
    .filter((w) => w !== expectedBody && !variants.includes(w));
  const otherMatch = normalizedOthers.find((w) => w === body);
  if (otherMatch) {
    return {
      kind: 'other_word',
      accepted: false,
      expected: expectedDisplay,
      otherWord: otherMatch,
    };
  }

  // Minor typo (1 edit on words >= 4 chars)
  if (expectedBody.length >= 4 && levenshteinDistance(body, expectedBody) === 1) {
    return {
      kind: 'close',
      accepted: true,
      expected: expectedDisplay,
      noteGl: `Case perfecto! Coidado cunha letra: escríbese «${target.word}».`,
    };
  }

  return { kind: 'wrong', accepted: false, expected: expectedDisplay };
}

export function checkRoomAnswer(rawInput: string, expectedRoomEn: string): boolean {
  const { body } = stripLeadingArticle(rawInput);
  return body === normalizeEnglish(expectedRoomEn);
}
