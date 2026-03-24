import { getAuthorById } from "@/lib/authors"

/** À partir des clés de titres (fichiers .txt), déduit slug_oeuvre RAGFlow et un libellé. */
export function workOptionsFromTitles(
  titles: Record<string, string>
): { slug: string; label: string }[] {
  const slugToLabel = new Map<string, string>()
  for (const [file, label] of Object.entries(titles)) {
    const base = file.replace(/\.txt$/i, "")
    const slug = base.includes("--") ? base.split("--")[0]! : base
    if (!slugToLabel.has(slug)) slugToLabel.set(slug, label)
  }
  return [...slugToLabel.entries()]
    .map(([slug, label]) => ({ slug, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr", { sensitivity: "base" }))
}

export function corpusWorkOptionsForAuthor(authorId: string) {
  const author = getAuthorById(authorId)
  if (!author) return []
  return workOptionsFromTitles(author.titles)
}
