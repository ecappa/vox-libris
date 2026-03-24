import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConstructionIcon } from "lucide-react"

export function SettingsPlaceholderView() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <Card className="max-w-lg">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <ConstructionIcon className="size-8 shrink-0 text-muted-foreground" />
          <div>
            <CardTitle className="text-lg">Réglages</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Cette section arrivera bientôt : préférences d’affichage, thème,
              et options liées au dialogue avec le corpus.
            </p>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Revenez plus tard ou utilisez le tableau de bord et les modes de
          dialogue depuis le menu.
        </CardContent>
      </Card>
    </div>
  )
}
