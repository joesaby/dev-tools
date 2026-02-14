import type { IndexedDocument } from "./types";

// ── Document Store ───────────────────────────────────────────────────

export class DocumentStore {
  private docs: Map<string, IndexedDocument> = new Map();

  load(documents: IndexedDocument[]): void {
    this.docs.clear();
    for (const doc of documents) {
      this.docs.set(doc.id, doc);
    }
  }

  get(id: string): IndexedDocument | undefined {
    return this.docs.get(id);
  }

  search(query: string): IndexedDocument[] {
    const lower = query.toLowerCase();
    return Array.from(this.docs.values()).filter(
      (doc) =>
        doc.title.toLowerCase().includes(lower) ||
        doc.content.toLowerCase().includes(lower),
    );
  }

  list(collection?: string): IndexedDocument[] {
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
