#!/usr/bin/env node

// ── doctree-mcp ──────────────────────────────────────────────────────
// MCP server that indexes documentation trees and exposes them as
// searchable resources via the Model Context Protocol.
//
// Environment variables:
//   DOCS_ROOT       – root directory for documents (default: ./docs)
//   MAX_DEPTH       – maximum directory traversal depth (default: 6)
//   SUMMARY_LENGTH  – character limit for summaries (default: 200)
// ─────────────────────────────────────────────────────────────────────

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { DocumentStore } from "./store";
import { indexAllCollections } from "./indexer";
import { singleRootConfig } from "./types";
import type { IndexConfig } from "./types";

// ── Configuration ────────────────────────────────────────────────────

const docs_root = process.env.DOCS_ROOT || "./docs";
const config: IndexConfig = singleRootConfig(docs_root);
config.max_depth = parseInt(process.env.MAX_DEPTH || "6");
config.summary_length = parseInt(process.env.SUMMARY_LENGTH || "200");

// ── Initialize store ─────────────────────────────────────────────────

const store = new DocumentStore();

// ── MCP Server ───────────────────────────────────────────────────────

const server = new Server(
  { name: "doctree-mcp", version: "1.0.0" },
  { capabilities: { resources: {}, tools: {} } },
);

// ── Resources: list ──────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const docs = store.list();
  return {
    resources: docs.map((doc) => ({
      uri: `doctree://${doc.id}`,
      name: doc.title,
      description: doc.summary,
      mimeType: "text/markdown",
    })),
  };
});

// ── Resources: read ──────────────────────────────────────────────────

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const id = uri.replace("doctree://", "");
  const doc = store.get(id);

  if (!doc) {
    throw new Error(`Document not found: ${id}`);
  }

  return {
    contents: [
      {
        uri,
        mimeType: "text/markdown",
        text: doc.content,
      },
    ],
  };
});

// ── Tools: list ──────────────────────────────────────────────────────

const SearchArgsSchema = z.object({
  query: z.string().describe("Search query string"),
  collection: z.string().optional().describe("Filter by collection name"),
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_docs",
        description:
          "Search indexed documentation by keyword. Returns matching document titles, paths, and summaries.",
        inputSchema: {
          type: "object" as const,
          properties: {
            query: { type: "string", description: "Search query string" },
            collection: {
              type: "string",
              description: "Filter by collection name",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_document",
        description:
          "Retrieve the full content of a document by its ID.",
        inputSchema: {
          type: "object" as const,
          properties: {
            id: {
              type: "string",
              description: "Document ID (collection:path)",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "list_documents",
        description:
          "List all indexed documents, optionally filtered by collection.",
        inputSchema: {
          type: "object" as const,
          properties: {
            collection: {
              type: "string",
              description: "Filter by collection name",
            },
          },
        },
      },
    ],
  };
});

// ── Tools: call ──────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "search_docs": {
      const parsed = SearchArgsSchema.parse(args);
      let results = store.search(parsed.query);
      if (parsed.collection) {
        results = results.filter((d) => d.collection === parsed.collection);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              results.map((d) => ({
                id: d.id,
                title: d.title,
                path: d.path,
                summary: d.summary,
              })),
              null,
              2,
            ),
          },
        ],
      };
    }

    case "get_document": {
      const id = z.object({ id: z.string() }).parse(args).id;
      const doc = store.get(id);
      if (!doc) {
        return {
          content: [{ type: "text" as const, text: `Document not found: ${id}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: doc.content }],
      };
    }

    case "list_documents": {
      const collection = z
        .object({ collection: z.string().optional() })
        .parse(args).collection;
      const docs = store.list(collection);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              docs.map((d) => ({
                id: d.id,
                title: d.title,
                path: d.path,
                collection: d.collection,
              })),
              null,
              2,
            ),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// ── Startup ──────────────────────────────────────────────────────────

async function main() {
  console.error(`[doctree-mcp] Indexing documents from: ${docs_root}`);

  // Index all documents at startup
  const startTime = Date.now();
  const documents = await indexAllCollections(config);
  store.load(documents);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.error(
    `[doctree-mcp] Indexed ${store.size} documents in ${elapsed}s`,
  );

  // Start MCP transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[doctree-mcp] Server started on stdio");
}

main().catch((err) => {
  console.error("[doctree-mcp] Fatal error:", err);
  process.exit(1);
});
