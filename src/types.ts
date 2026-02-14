// ── Types ────────────────────────────────────────────────────────────

export interface CollectionConfig {
  name: string;
  docs_root: string;
  glob_pattern: string;
}

export interface IndexConfig {
  collections: CollectionConfig[];
  max_depth: number;
  summary_length: number;
}

export interface Document {
  id: string;
  collection: string;
  path: string;
  title: string;
  content: string;
  summary: string;
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
        docs_root,
        glob_pattern: "**/*.md",
      },
    ],
    max_depth: 6,
    summary_length: 200,
  };
}
