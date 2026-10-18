export type GitReviewScope = "all" | "uncommitted" | "commit";
export type GitReviewContext = 3 | 20 | "all";
export type GitReviewFileStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "conflict"
  | "typechange";

export interface GitReviewRef {
  /** Full, unambiguous refs/heads/... or refs/remotes/... name. */
  name: string;
  oid: string;
  isDefault?: boolean;
}

export interface GitReviewCommit {
  oid: string;
  subject: string;
  authorName: string;
  authoredAt: string;
}

export interface GitReviewFile {
  /** Repository-relative path with forward-slash separators. */
  path: string;
  oldPath?: string;
  status: GitReviewFileStatus;
  additions: number;
  deletions: number;
  binary?: boolean;
}

export interface GitReviewSnapshot {
  repoRoot: string;
  currentBranch: string | null;
  headOid: string;
  baseRef: string | null;
  baseOid: string;
  comparisonId: string;
  scope: GitReviewScope;
  refs: GitReviewRef[];
  commits: GitReviewCommit[];
  files: GitReviewFile[];
  totals: { additions: number; deletions: number };
  large: boolean;
  /** At least one metadata collection (commits, refs, or files) hit its cap. */
  truncated?: boolean;
  error?: string;
}

export interface GitReviewPatch {
  comparisonId: string;
  path: string;
  oldPath?: string;
  patch: string;
  supported: boolean;
  reason?: "binary" | "too-large" | "metadata-only";
  truncated?: boolean;
  error?: string;
}

export interface GitReviewOptions {
  cwd: string;
  scope?: GitReviewScope;
  /** Full refs/heads/... or refs/remotes/... name. Defaults to origin/main, main, then master. */
  base?: string;
  /** Full commit object ID; required for commit scope. */
  commit?: string;
  /** Omit for a snapshot; provide a repository-relative path for a lazy patch. */
  path?: string;
  ignoreWhitespace?: boolean;
  context?: GitReviewContext;
}

export type GitReviewResponse = GitReviewSnapshot | GitReviewPatch;
