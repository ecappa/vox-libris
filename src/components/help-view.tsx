import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquareTextIcon } from "lucide-react"

export function HelpView() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <Card className="max-w-2xl">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <MessageSquareTextIcon className="mt-0.5 size-7 shrink-0 text-primary" />
          <CardTitle className="text-lg">Qu’est-ce que Vox Libris ?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            Vox Libris est une application de dialogue littéraire : vous
            conversez avec des œuvres de grands auteurs du XIXᵉ siècle —
            notamment Victor Hugo, Émile Zola et Jules Verne — grâce à un
            système de recherche augmentée (RAG). Les réponses s’appuient sur
            des extraits réellement présents dans le corpus indexé.
          </p>
          <p>
            Trois modes de conversation sont prévus : un mode érudit (analyse
            et citations), un mode apprentissage (pédagogie), et un mode jeune
            (langage accessible). Le tableau de bord permet de suivre l’état des
            jeux de données et des documents dans RAGFlow.
          </p>
          <p className="text-xs">
            Les textes proviennent d’éditions numériques structurées ; le projet
            vise chercheurs, étudiants et lecteurs curieux.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
