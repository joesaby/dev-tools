import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { minimatch } from "minimatch";

import type {
  TreeNode,
  CollectionConfig,
  IndexConfig,
  IndexedDocument,
} from "./types";

// ── Parse state ──────────────────────────────────────────────────────

interface ParseState {
  doc_id: string;
  node_counter: number;
  nodes: TreeNode[];
  current_content: string[];
  current_level: number;
  current_title: string;
  current_id: string | null;
  parent_stack: { id: string; level: number }[];
}

function createParseState(doc_id: string): ParseState {
  return {
    doc_id,
    node_counter: 0,
    nodes: [],
    current_content: [],
    current_level: 0,
    current_title: "",
    current_id: null,
    parent_stack: [],
  };
}

// ── Flush accumulated content into the current node ──────────────────

function flushContent(state: ParseState): void {
  if (state.current_id === null) return;

  const content = state.current_content.join("\n").trim();
  const node = state.nodes.find((n) => n.id === state.current_id);
  if (node) {
    node.content = content;
  }
  state.current_content = [];
}

// ── Find parent node for a given heading level ───────────────────────

function findParentId(state: ParseState, level: number): string | null {
  for (let i = state.parent_stack.length - 1; i >= 0; i--) {
    if (state.parent_stack[i].level < level) {
      return state.parent_stack[i].id;
    }
  }
  return null;
}

// ── Check if Bun.markdown is available (requires Bun 1.3.8+) ─────────

const hasBunMarkdown = typeof Bun !== "undefined" &&
  typeof (Bun as any).markdown?.render === "function";

if (!hasBunMarkdown) {
  console.log("[doctree] Using regex parser (Bun.markdown requires Bun 1.3.8+)");
}

// ── Core: Build tree from markdown ───────────────────────────────────

export function buildTree(markdown: string, doc_id: string): TreeNode[] {
  if (!hasBunMarkdown) {
    return buildTreeRegex(markdown, doc_id);
  }

  const state = createParseState(doc_id);
  const lines = markdown.split("\n");

  try {
    (Bun as any).markdown.render(markdown, {
      heading: (children: string, { level }: { level: number }) => {
        flushContent(state);
        state.node_counter++;
        const id = `${doc_id}#node-${state.node_counter}`;
        const parent_id = findParentId(state, level);

        state.nodes.push({
          id,
          parent_id,
          level,
          title: stripHtml(children).trim(),
          content: "",
          doc_id,
        });

        // Update parent stack
        while (
          state.parent_stack.length > 0 &&
          state.parent_stack[state.parent_stack.length - 1].level >= level
        ) {
          state.parent_stack.pop();
        }
        state.parent_stack.push({ id, level });

        state.current_id = id;
        state.current_level = level;
        state.current_title = stripHtml(children).trim();

        return `<h${level}>${children}</h${level}>`;
      },
      paragraph: (children: string) => {
        state.current_content.push(stripHtml(children).trim());
        return `<p>${children}</p>`;
      },
      text: (text: string) => {
        return text;
      },
      codeblock: (code: string, language: string) => {
        state.current_content.push("```" + (language || "") + "\n" + code + "```");
        return `<pre><code class="language-${language}">${code}</code></pre>`;
      },
      list: (children: string, ordered: boolean) => {
        state.current_content.push(stripHtml(children).trim());
        const tag = ordered ? "ol" : "ul";
        return `<${tag}>${children}</${tag}>`;
      },
      listitem: (children: string) => {
        return `<li>${children}</li>`;
      },
      blockquote: (children: string) => {
        state.current_content.push("> " + stripHtml(children).trim());
        return `<blockquote>${children}</blockquote>`;
      },
      table: (children: string) => {
        state.current_content.push(stripHtml(children).trim());
        return `<table>${children}</table>`;
      },
      link: (href: string, title: string | null, children: string) => {
        return `<a href="${href}">${children}</a>`;
      },
      image: (src: string, alt: string | null) => {
        return `<img src="${src}" alt="${alt || ""}">`;
      },
    });
  } catch (e) {
    return buildTreeRegex(markdown, doc_id);
  }

  flushContent(state);

  // If no headings were found, create a single root node
  if (state.nodes.length === 0) {
    state.nodes.push({
      id: `${doc_id}#node-1`,
      parent_id: null,
      level: 0,
      title: doc_id,
      content: markdown.trim(),
      doc_id,
    });
  }

  return state.nodes;
}

// ── Regex-based markdown parser ──────────────────────────────────────

function buildTreeRegex(markdown: string, doc_id: string): TreeNode[] {
  const lines = markdown.split("\n");
  const nodes: TreeNode[] = [];
  let counter = 0;
  let current_content: string[] = [];
  let parent_stack: { id: string; level: number }[] = [];

  const headingRegex = /^(#{1,6})\s+(.+)$/;

  for (const line of lines) {
    const match = line.match(headingRegex);
    if (match) {
      // Flush content to previous node
      if (nodes.length > 0) {
        nodes[nodes.length - 1].content = current_content.join("\n").trim();
        current_content = [];
      }

      counter++;
      const level = match[1].length;
      const title = match[2].trim();
      const id = `${doc_id}#node-${counter}`;

      // Find parent
      let parent_id: string | null = null;
      for (let i = parent_stack.length - 1; i >= 0; i--) {
        if (parent_stack[i].level < level) {
          parent_id = parent_stack[i].id;
          break;
        }
      }

      // Update parent stack
      while (
        parent_stack.length > 0 &&
        parent_stack[parent_stack.length - 1].level >= level
      ) {
        parent_stack.pop();
      }
      parent_stack.push({ id, level });

      nodes.push({
        id,
        parent_id,
        level,
        title,
        content: "",
        doc_id,
      });
    } else {
      current_content.push(line);
    }
  }

  // Flush remaining content
  if (nodes.length > 0) {
    nodes[nodes.length - 1].content = current_content.join("\n").trim();
  }

  // If no headings were found, create a single root node
  if (nodes.length === 0) {
    nodes.push({
      id: `${doc_id}#node-1`,
      parent_id: null,
      level: 0,
      title: doc_id,
      content: markdown.trim(),
      doc_id,
    });
  }

  return nodes;
}

// ── Directory walking ────────────────────────────────────────────────

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

// ── Index a single collection ────────────────────────────────────────

async function indexCollection(
  collection: CollectionConfig,
): Promise<IndexedDocument[]> {
  const docs: IndexedDocument[] = [];
  const files = await walkDir(collection.root, collection.glob_pattern, 10);

  for (const filePath of files) {
    const content = await readFile(filePath, "utf-8");
    const relPath = relative(collection.root, filePath);
    const id = `${collection.name}:${relPath}`;
    const tree = buildTree(content, id);

    const title = tree.length > 0 && tree[0].title !== id
      ? tree[0].title
      : relPath;

    const text = content
      .replace(/^#+\s.*/gm, "")
      .replace(/\n{2,}/g, "\n")
      .trim();
    const summary = text.length > 200 ? text.slice(0, 200) + "..." : text;

    docs.push({
      id,
      collection: collection.name,
      path: relPath,
      title,
      content,
      summary,
      tree,
    });
  }

  return docs;
}

// ── Index all collections ────────────────────────────────────────────

export async function indexAllCollections(
  config: IndexConfig,
): Promise<IndexedDocument[]> {
  const allDocs: IndexedDocument[] = [];

  for (const collection of config.collections) {
    const docs = await indexCollection(collection);
    allDocs.push(...docs);
  }

  return allDocs;
}

/**
 * Backwards-compatible wrapper for indexing a single directory.
 * @deprecated Use indexAllCollections with singleRootConfig instead.
 */
export async function indexDirectory(config: {
  docs_root: string;
  glob_pattern?: string;
  max_depth?: number;
  summary_length?: number;
}): Promise<IndexedDocument[]> {
  const collection: CollectionConfig = {
    name: "docs",
    root: config.docs_root,
    weight: 1.0,
    glob_pattern: config.glob_pattern || "**/*.md",
  };
  return indexCollection(collection);
}

// ── Helpers ──────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}
