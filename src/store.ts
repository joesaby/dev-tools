import type { Document } from "./types";

// ── Document Store ───────────────────────────────────────────────────

export class DocumentStore {
  private docs: Map<string, Document> = new Map();

  load(documents: Document[]): void {
    this.docs.clear();
    for (const doc of documents) {
      this.docs.set(doc.id, doc);
    }
  }

  get(id: string): Document | undefined {
    return this.docs.get(id);
  }

  search(query: string): Document[] {
    const lower = query.toLowerCase();
    return Array.from(this.docs.values()).filter(
      (doc) =>
        doc.title.toLowerCase().includes(lower) ||
        doc.content.toLowerCase().includes(lower),
    );
  }

  list(collection?: string): Document[] {
    const all = Array.from(this.docs.values());
    if (collection) {
      return all.filter((doc) => doc.collection === collection);
    }
    return all;
  }

  get size(): number {
    return this.docs.size;
  }
}
