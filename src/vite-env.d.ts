/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RAGFLOW_CHAT_JEUNE?: string
  readonly VITE_RAGFLOW_CHAT_ERUDIT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
