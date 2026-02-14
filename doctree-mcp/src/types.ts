// ── Types ────────────────────────────────────────────────────────────

export interface TreeNode {
  id: string;
  parent_id: string | null;
  level: number;
  title: string;
  content: string;
  doc_id: string;
}

export interface CollectionConfig {
  name: string;
  root: string;
  weight: number;
  glob_pattern: string;
}

export interface IndexConfig {
  collections: CollectionConfig[];
  max_depth: number;
  summary_length: number;
}

export interface IndexedDocument {
  id: string;
  collection: string;
  path: string;
  title: string;
  content: string;
  summary: string;
  tree: TreeNode[];
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Create an IndexConfig from a single docs root directory.
 */
export function singleRootConfig(docs_root: string): IndexConfig {
  return {
    collections: [
      {
        name: "default",
        root: docs_root,
        weight: 1.0,
        glob_pattern: "**/*.md",
      },
    ],
    max_depth: 6,
    summary_length: 200,
  };
}
