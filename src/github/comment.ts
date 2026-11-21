import type { GitHubComment, GitHubCommentOptions } from './types.js';

export const STICKY_COMMENT_MARKER = '<!-- seo-gate-sticky-comment -->';

export class GitHubApiError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

/**
 * Posts or updates a single sticky comment on a GitHub pull request.
 * Search for STICKY_COMMENT_MARKER to update existing comment in place.
 */
export async function postOrUpdateStickyComment(
  options: GitHubCommentOptions
): Promise<{ action: 'created' | 'updated'; commentId: number }> {
  const apiBase = options.apiBaseUrl || 'https://api.github.com';
  const headers = {
    Authorization: `Bearer ${options.token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'seo-gate-bot',
    'Content-Type': 'application/json',
  };

  const markedBody = `${STICKY_COMMENT_MARKER}\n${options.body}`;

  // 1. Fetch existing comments for this PR
  const listUrl = `${apiBase}/repos/${options.owner}/${options.repo}/issues/${options.prNumber}/comments`;
  let existingComments: GitHubComment[] = [];

  try {
    const response = await fetch(listUrl, { headers });
    if (!response.ok) {
      throw new GitHubApiError(
        `Failed to fetch PR comments: HTTP ${response.status} ${response.statusText}`,
        response.status
      );
    }
    existingComments = (await response.json()) as GitHubComment[];
  } catch (err) {
    if (err instanceof GitHubApiError) throw err;
    throw new GitHubApiError(`Network error querying GitHub comments: ${(err as Error).message}`);
  }

  // 2. Search for existing sticky comment with marker
  const existing = existingComments.find(
    (c) => typeof c.body === 'string' && c.body.includes(STICKY_COMMENT_MARKER)
  );

  if (existing) {
    // 3. Update existing comment in place
    const updateUrl = `${apiBase}/repos/${options.owner}/${options.repo}/issues/comments/${existing.id}`;
    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ body: markedBody }),
    });

    if (!updateResponse.ok) {
      throw new GitHubApiError(
        `Failed to update sticky PR comment: HTTP ${updateResponse.status} ${updateResponse.statusText}`,
        updateResponse.status
      );
    }

    return { action: 'updated', commentId: existing.id };
  } else {
    // 4. Create new comment
    const createResponse = await fetch(listUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body: markedBody }),
    });

    if (!createResponse.ok) {
      throw new GitHubApiError(
        `Failed to post sticky PR comment: HTTP ${createResponse.status} ${createResponse.statusText}`,
        createResponse.status
      );
    }

    const created = (await createResponse.json()) as GitHubComment;
    return { action: 'created', commentId: created.id };
  }
}
