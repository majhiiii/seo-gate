export interface GitHubCommentOptions {
  owner: string;
  repo: string;
  prNumber: number;
  token: string;
  body: string;
  apiBaseUrl?: string;
}

export interface GitHubComment {
  id: number;
  body: string;
  user?: {
    login: string;
  };
  created_at: string;
  updated_at: string;
}
