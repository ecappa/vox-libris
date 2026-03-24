import HUGO_TITLES from "./hugo-titles"
import ZOLA_TITLES from "./zola-titles"
import VERNE_TITLES from "./verne-titles"

export interface AuthorConfig {
  id: string
  name: string
  datasetId: string
  titles: Record<string, string>
}

export const AUTHORS: AuthorConfig[] = [
  {
    id: "victor-hugo",
    name: "Victor Hugo",
    datasetId: "14ef8d8e271611f1a5a87db1341041f4",
    titles: HUGO_TITLES,
  },
  {
    id: "emile-zola",
    name: "Émile Zola",
    datasetId: "0590e0b2272b11f1a5a87db1341041f4",
    titles: ZOLA_TITLES,
  },
  {
    id: "jules-verne",
    name: "Jules Verne",
    datasetId: "09754114272b11f1a5a87db1341041f4",
    titles: VERNE_TITLES,
  },
]

export function getAuthorById(id: string): AuthorConfig | undefined {
  return AUTHORS.find((a) => a.id === id)
}

export function resolveTitle(authorId: string, filename: string): string {
  const author = getAuthorById(authorId)
  if (author) {
    return (
      author.titles[filename] ??
      filename.replace(/\.txt$/, "").replace(/-/g, " ")
    )
  }
  return filename.replace(/\.txt$/, "").replace(/-/g, " ")
}
