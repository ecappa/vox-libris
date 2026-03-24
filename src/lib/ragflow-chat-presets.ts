/**
 * Identifiants d’assistants RAGFlow par défaut (Vox Libris).
 * Surcharge possible via variables VITE_* pour tests ou nouveaux déploiements.
 */
export interface RagflowAssistantPreset {
  id: string
  label: string
  description: string
}

const jeune =
  import.meta.env.VITE_RAGFLOW_CHAT_JEUNE ??
  "79a5a94a273c11f1a5a87db1341041f4"
const erudit =
  import.meta.env.VITE_RAGFLOW_CHAT_ERUDIT ??
  "9c9b99a8272011f1a5a87db1341041f4"

export const RAGFLOW_ASSISTANT_PRESETS: RagflowAssistantPreset[] = [
  {
    id: jeune,
    label: "Mode jeune",
    description: "Ton accessible, découverte des œuvres",
  },
  {
    id: erudit,
    label: "Mode érudit",
    description: "Analyse précise et références au corpus",
  },
]

export function resolvePresetChatId(chatId: string): RagflowAssistantPreset | null {
  return RAGFLOW_ASSISTANT_PRESETS.find((p) => p.id === chatId) ?? null
}
