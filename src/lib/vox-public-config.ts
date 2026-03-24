/** Données publiques (pas de secrets) — alignées sur api/lib/ragflow-gateway DEFAULT. */
export type VoxPublicAssistant = {
  id: string
  label: string
  description: string
}

export const FALLBACK_ASSISTANTS: VoxPublicAssistant[] = [
  {
    id: "79a5a94a273c11f1a5a87db1341041f4",
    label: "Mode jeune",
    description: "Ton accessible, découverte des œuvres",
  },
  {
    id: "9c9b99a8272011f1a5a87db1341041f4",
    label: "Mode érudit",
    description: "Analyse précise et références au corpus",
  },
]

export function resolvePresetForChatId(
  assistants: VoxPublicAssistant[],
  chatId: string
): VoxPublicAssistant | null {
  return assistants.find((p) => p.id === chatId) ?? null
}
