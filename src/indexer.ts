import { readdir, readFile } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { minimatch } from "minimatch";

import type { IndexConfig, Document } from "./types";

// ── Indexing ─────────────────────────────────────────────────────────

/**
 * Walk a directory tree up to `maxDepth` and return all matching file paths.
 */
async function walkDir(
  dir: string,
  globPattern: string,
  maxDepth: number,
  currentDepth = 0,
): Promise<string[]> {
  if (currentDepth > maxDepth) return [];

  const entries = await readdir(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await walkDir(fullPath, globPattern, maxDepth, currentDepth + 1);
      results.push(...sub);
    } else if (minimatch(entry.name, globPattern)) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Generate a summary from document content.
 */
function summarize(content: string, length: number): string {
  const text = content.replace(/^#+\s.*/gm, "").replace(/\n{2,}/g, "\n").trim();
  return text.length > length ? text.slice(0, length) + "..." : text;
}

/**
 * Extract a title from a Markdown document.
 */
function extractTitle(content: string, filePath: string): string {
  const match = content.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : filePath;
}

/**
 * Index all collections defined in the config and return Documents.
 * Replaces the old `indexDirectory` which only supported a single root.
 */
export async function indexAllCollections(config: IndexConfig): Promise<Document[]> {
  const documents: Document[] = [];

  for (const collection of config.collections) {
    const files = await walkDir(
      collection.docs_root,
      collection.glob_pattern,
      config.max_depth,
    );

    for (const filePath of files) {
      const content = await readFile(filePath, "utf-8");
      const relPath = relative(collection.docs_root, filePath);
      const id = `${collection.name}:${relPath}`;

      documents.push({
        id,
        collection: collection.name,
        path: relPath,
        title: extractTitle(content, relPath),
        content,
        summary: summarize(content, config.summary_length),
      });
    }
  }

  return documents;
}
