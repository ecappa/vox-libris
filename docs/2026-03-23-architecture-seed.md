# Architecture Seed

**Source**: vox-libris  
**Date d'extraction**: 2026-03-23  
**But**: Définir l'architecture technique de Vox Libris — une application de dialogue littéraire RAG-powered.

---

## Table des Matières

1. [Vision Produit](#1-vision-produit)
2. [Stack Technique](#2-stack-technique)
3. [Architecture Globale](#3-architecture-globale)
4. [Structure du Projet](#4-structure-du-projet)
5. [Configuration & Build](#5-configuration--build)
6. [Design System & Thème](#6-design-system--thème)
7. [Routing & Navigation](#7-routing--navigation)
8. [Layout & Responsive](#8-layout--responsive)
9. [Couche Services](#9-couche-services)
10. [Couche Hooks (React Query)](#10-couche-hooks-react-query)
11. [State Management](#11-state-management)
12. [Authentification & Rôles](#12-authentification--rôles)
13. [Interface de Chat](#13-interface-de-chat)
14. [Intégration RAGFlow](#14-intégration-ragflow)
15. [PocketBase Backend](#15-pocketbase-backend)
16. [Internationalisation (i18n)](#16-internationalisation-i18n)
17. [Docker & Déploiement](#17-docker--déploiement)
18. [Conventions de Code](#18-conventions-de-code)

---

## 1. Vision Produit

Vox Libris permet de **dialoguer avec les œuvres complètes** de Victor Hugo, Émile Zola et Jules Verne à travers un système RAG (Retrieval-Augmented Generation) propulsé par RAGFlow.

### Trois modes de dialogue

| Mode | Public cible | Comportement |
|------|-------------|--------------|
| **Érudit** | Chercheurs, étudiants, passionnés | Analyse académique, citations systématiques, intertextualité, refus explicite si hors corpus |
| **Apprentissage** | Lecteurs curieux, lycéens | Pédagogique, contextualisation historique, aide vocabulaire, pistes de réflexion |
| **Jeune** | Adolescents, collégiens | Langage accessible et engageant, parallèles contemporains, rend l'auteur vivant |

### Fonctionnalités clés

- Chat conversationnel multi-tours avec un auteur/corpus
- Citations sourcées (œuvre, chapitre)
- Filtrage par œuvre, genre, période
- Historique des conversations
- Sélection d'auteur et de mode via l'interface

---

## 2. Stack Technique

### Core

| Couche | Technologie | Version |
|--------|------------|---------|
| Runtime | React | 18.x |
| Language | TypeScript | 5.x |
| Bundler | Vite | 5.x (plugin react-swc) |
| CSS | Tailwind CSS | 3.x |
| UI Kit | shadcn/ui (style: default) | — |
| Primitives | Radix UI | — |
| Backend local | PocketBase (Auth, Users, Preferences, History) | SDK JS 0.x |
| Backend RAG | RAGFlow (Datasets, Retrieval, Chat Assistants) | v0.24.0 |
| State serveur | TanStack React Query | 5.x |
| Routing | React Router DOM | 6.x |
| Formulaires | React Hook Form + Zod | RHF 7.x, Zod 3.x |
| Icônes | Lucide React | 0.462+ |
| Date | date-fns | 3.x |
| Notifications | Sonner | 1.x |
| Thème | next-themes (dark mode) | 0.3.x |
| i18n | i18next + react-i18next | 25.x / 16.x |
| Markdown rendering | react-markdown + remark-gfm | — |

### Conventions linguistiques

- UI et documentation : **français**
- Code (variables, fonctions, composants) : **anglais**

---

## 3. Architecture Globale

```
┌──────────────────────────────────────────────────────────────┐
│                     VPS OVH (Beauharnois)                    │
│                                                              │
│  ┌─────────────┐   ┌───────────────┐   ┌──────────────────┐ │
│  │   Nginx     │   │  PocketBase   │   │    RAGFlow       │ │
│  │  (port 80)  │──▶│  (port 8090)  │   │  (port 8080)     │ │
│  │  (port 443) │   │               │   │                  │ │
│  │             │──▶│  ┌──────────┐ │   │  ┌────────────┐  │ │
│  │  ┌────────┐ │   │  │ SQLite   │ │   │  │ Datasets   │  │ │
│  │  │ SPA    │ │   │  └──────────┘ │   │  │ Assistants │  │ │
│  │  │(React) │ │   │               │   │  │ Sessions   │  │ │
│  │  └────────┘ │   │  Users        │   │  │ Retrieval  │  │ │
│  │             │──▶│  Preferences  │   │  └────────────┘  │ │
│  │             │   │  History refs │   │                  │ │
│  └─────────────┘   └───────────────┘   └──────────────────┘ │
│                                                              │
│  Nginx reverse-proxies:                                      │
│    /api/pb/  → PocketBase :8090                              │
│    /api/rf/  → RAGFlow :8080                                 │
│    /*        → SPA static files                              │
└──────────────────────────────────────────────────────────────┘
```

### Séparation des responsabilités

| Système | Responsabilité | Données |
|---------|---------------|---------|
| **PocketBase** | Auth, profils utilisateur, préférences, références conversations | Users, settings, conversation_refs |
| **RAGFlow** | Datasets littéraires, chunking, embeddings, retrieval, chat assistants, sessions de dialogue | Corpus complet, sessions RAG, chunks |
| **Nginx** | TLS, reverse proxy, fichiers SPA | — |

Le frontend parle aux **deux backends** :
- PocketBase pour l'auth et les données utilisateur
- RAGFlow pour tout ce qui est dialogue / retrieval

---

## 4. Structure du Projet

```
src/
├── main.tsx                    # Point d'entrée
├── App.tsx                     # Routes (BrowserRouter + Routes)
├── index.css                   # Tailwind directives + thème CSS variables
│
├── components/
│   ├── ui/                     # shadcn/ui (composants génériques)
│   ├── layout/                 # AppLayout, AppSidebar, ProtectedRoute
│   ├── chat/                   # ChatWindow, ChatMessage, ChatInput, SourceCitation
│   ├── author/                 # AuthorSelector, AuthorCard
│   └── mode/                   # ModeSelector, ModeDescription
│
├── pages/
│   ├── ChatPage.tsx            # Page principale de dialogue
│   ├── AuthorPage.tsx          # Sélection d'auteur + ses œuvres
│   ├── HistoryPage.tsx         # Historique des conversations
│   ├── SettingsPage.tsx        # Préférences utilisateur
│   ├── Login.tsx
│   └── NotFound.tsx
│
├── services/
│   ├── index.ts                # Barrel export
│   ├── ragflow.service.ts      # Client RAGFlow (datasets, chat, retrieval)
│   ├── auth.service.ts         # Auth PocketBase
│   └── user.service.ts         # Préférences, historique refs
│
├── hooks/
│   ├── useChat.ts              # Hook principal : envoi message, stream réponse, historique
│   ├── useRetrieval.ts         # Recherche standalone dans le corpus
│   ├── useAuthors.ts           # Liste des auteurs / datasets disponibles
│   ├── useConversations.ts     # Historique conversations (refs PB + sessions RAGFlow)
│   ├── useAuth.ts              # Auth hook
│   └── usePreferences.ts      # Mode, auteur favori, etc.
│
├── lib/
│   ├── pocketbase.ts           # Instance PocketBase singleton
│   ├── ragflow.ts              # Client RAGFlow (fetch wrapper, auth, streaming)
│   ├── queryClient.ts          # Config React Query + queryKeys
│   ├── utils.ts                # cn() (clsx + tailwind-merge)
│   └── schemas/
│       ├── auth.schema.ts      # Validation login
│       └── chat.schema.ts      # Validation message input
│
├── contexts/
│   └── AuthContext.tsx          # Auth PocketBase + rôles
│
├── types/
│   ├── pocketbase-types.ts     # Types collections PocketBase
│   └── ragflow-types.ts        # Types réponses RAGFlow (datasets, chunks, chat)
│
├── i18n/
│   ├── index.ts
│   └── locales/
│       ├── fr.json
│       └── en.json
│
└── __tests__/

docker/
├── docker-compose.yml          # PocketBase + Nginx (RAGFlow déjà déployé séparément)
├── nginx/
│   └── default.conf            # Reverse proxy → PocketBase + RAGFlow + SPA
└── pocketbase/
    ├── pb_migrations/
    └── pb_hooks/
```

---

## 5. Configuration & Build

### Vite (`vite.config.ts`)

```typescript
export default defineConfig(({ mode }) => ({
  server: { host: "::", port: 8080 },
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-radix': ['@radix-ui/react-dialog', '@radix-ui/react-popover'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor-pocketbase': ['pocketbase'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-markdown': ['react-markdown', 'remark-gfm'],
        },
      },
    },
  },
}));
```

### TypeScript

- `strict: true`
- Path alias : `@/*` → `./src/*`
- Module : ESNext, moduleResolution: bundler

### Variables d'environnement

```bash
# Frontend (build-time, injectées dans le bundle via Vite)
VITE_POCKETBASE_URL=http://localhost:8090          # Dev: PocketBase direct
VITE_RAGFLOW_URL=http://localhost:8080             # Dev: RAGFlow direct

# En production, les deux passent par le proxy Nginx :
# VITE_POCKETBASE_URL=/api/pb
# VITE_RAGFLOW_URL=/api/rf

# Serveur uniquement (jamais dans le frontend)
RAGFLOW_ADMIN_API_KEY=ragflow-...                  # Injecté dans Nginx via envsubst
PB_ENCRYPTION_KEY=...                              # Chiffrement SQLite PocketBase
```

La clé API RAGFlow est injectée **côté serveur par Nginx** dans le header `Authorization`. Le frontend ne la connaît pas — il envoie ses requêtes à `/api/rf/` et Nginx ajoute l'auth avant de proxier vers RAGFlow.

---

## 6. Design System & Thème

### Identité visuelle

L'application doit évoquer une **bibliothèque classique** avec une touche moderne : tons chauds, typographie soignée pour la lecture, ambiance "cabinet de curiosités littéraire".

### Tailwind Config

- **Dark mode** : `class` strategy (via `next-themes`) — mode sombre par défaut
- **Container** : centré, padding 2rem, max 1200px
- **Couleurs** : CSS variables HSL
- **Animations** : `fade-in`, `slide-in`, `typing` (indicateur de frappe IA)

### Couleurs sémantiques (à définir)

```css
:root {
  --primary: /* ambre / or ancien */;
  --primary-foreground: /* brun foncé */;
  --background: /* crème / parchemin */;
  --foreground: /* encre noire */;
  --muted: /* gris chaud */;
  --accent: /* bordeaux */;
  --radius: 0.5rem;
}

.dark {
  --background: /* brun très foncé */;
  --foreground: /* crème clair */;
  /* Ambiance bibliothèque nocturne */
}
```

### Typographie

- **Titres et citations** : serif (ex: Playfair Display, Lora, Crimson Text)
- **Corps / UI** : sans-serif (ex: Source Sans 3, Nunito Sans)
- **Texte littéraire dans le chat** : serif avec espacement de lecture confortable

---

## 7. Routing & Navigation

```
/login                          → Login (public)

/ (AppLayout + ProtectedRoute)
├── /                           → Redirect vers /chat ou page d'accueil
├── /chat                       → ChatPage (dialogue principal)
│   └── /chat/:sessionId        → ChatPage (conversation existante)
├── /authors                    → AuthorPage (sélection auteur)
│   └── /authors/:slug          → AuthorPage (détail auteur + œuvres)
├── /history                    → HistoryPage (conversations passées)
├── /settings                   → SettingsPage (préférences)
└── *                           → NotFound
```

- Lazy loading pour toutes les pages
- `ProtectedRoute` vérifie l'auth PocketBase

---

## 8. Layout & Responsive

### AppLayout

- **Desktop** : sidebar gauche (auteurs, mode, historique) + zone de chat principale
- **Mobile** : sidebar en sheet (offcanvas) + chat plein écran

### Zone de chat

```
┌─────────────────────────────────────────┐
│  [Auteur: Victor Hugo]  [Mode: Érudit] │  ← Header contextuel
├─────────────────────────────────────────┤
│                                         │
│  Messages scrollables                   │  ← Flex-1, overflow-y-auto
│  (user + assistant + citations)         │
│                                         │
├─────────────────────────────────────────┤
│  [Filtrer par œuvre ▾]  [Message...]  ▶ │  ← Input sticky bottom
└─────────────────────────────────────────┘
```

- Les messages de l'assistant incluent les citations (sources) inline ou en accordéon
- Indicateur de frappe pendant le streaming
- Bouton "Nouvelle conversation"

---

## 9. Couche Services

### `ragflow.service.ts` — Interface avec RAGFlow

```typescript
import type { RagflowDataset, RagflowChatResponse, RagflowChunk } from '@/types/ragflow-types';

const BASE_URL = '/api/rf/v1';  // Proxié par Nginx

export const ragflowService = {
  async listDatasets(): Promise<RagflowDataset[]> { ... },

  async listAssistants(): Promise<RagflowAssistant[]> { ... },

  async createSession(chatId: string, name: string): Promise<RagflowSession> { ... },

  async sendMessage(
    chatId: string,
    question: string,
    options: {
      sessionId?: string;
      stream?: boolean;
      mode?: 'erudit' | 'apprentissage' | 'jeune';
      metadataCondition?: MetadataCondition;
    }
  ): Promise<ReadableStream | RagflowChatResponse> { ... },

  async retrieve(
    datasetIds: string[],
    question: string,
    options?: RetrievalOptions
  ): Promise<RagflowChunk[]> { ... },
};
```

### `auth.service.ts` — Auth PocketBase

```typescript
export const authService = {
  async login(email: string, password: string) { ... },
  async register(email: string, password: string, name: string) { ... },
  async logout() { ... },
  async refreshAuth() { ... },
};
```

### `user.service.ts` — Préférences et historique

```typescript
export const userService = {
  async getPreferences(userId: string): Promise<UserPreferences> { ... },
  async updatePreferences(userId: string, prefs: Partial<UserPreferences>) { ... },
  async listConversations(userId: string): Promise<ConversationRef[]> { ... },
  async saveConversation(ref: ConversationRef) { ... },
  async deleteConversation(id: string) { ... },
};
```

---

## 10. Couche Hooks (React Query)

### Query Keys

```typescript
export const queryKeys = {
  auth: { all: ['auth'], user: ['auth', 'user'] },
  authors: {
    all: ['authors'] as const,
    detail: (slug: string) => ['authors', slug] as const,
  },
  conversations: {
    all: ['conversations'] as const,
    detail: (id: string) => ['conversations', id] as const,
  },
  chat: {
    session: (sessionId: string) => ['chat', 'session', sessionId] as const,
  },
  preferences: {
    user: (userId: string) => ['preferences', userId] as const,
  },
};
```

### `useChat` — Hook principal

```typescript
export function useChat(chatId: string, sessionId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const { preferences } = usePreferences();

  const sendMessage = useCallback(async (question: string, filters?: MetadataCondition) => {
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setIsStreaming(true);

    const stream = await ragflowService.sendMessage(chatId, question, {
      sessionId,
      stream: true,
      mode: preferences.mode,
      metadataCondition: filters,
    });

    // Process SSE stream, accumulate assistant response
    // Extract references/citations from response
    // Update messages state progressively

    setIsStreaming(false);
  }, [chatId, sessionId, preferences.mode]);

  return { messages, sendMessage, isStreaming };
}
```

---

## 11. State Management

| Type de state | Solution |
|--------------|---------|
| Données serveur (conversations, préférences) | React Query |
| Auth / session | `AuthContext` (PocketBase authStore) |
| Messages de chat en cours | `useState` local dans `useChat` |
| Mode de dialogue actif | Préférences utilisateur (PocketBase) |
| Filtres (œuvre, genre) | `useState` local ou `useSearchParams` |

---

## 12. Authentification & Rôles

### PocketBase Auth

Login obligatoire. PocketBase gère les comptes utilisateurs via sa collection `users` (type auth).

```typescript
const { user, isAuthenticated, login, logout } = useAuth();
```

### Rôles

| Rôle | Accès |
|------|-------|
| `user` | Chat, historique, préférences |
| `admin` | + gestion datasets, monitoring, stats |

---

## 13. Interface de Chat

### Composants

| Composant | Rôle |
|-----------|------|
| `ChatWindow` | Container principal, gère le scroll et le layout des messages |
| `ChatMessage` | Affiche un message (user ou assistant), avec markdown rendering |
| `SourceCitation` | Affiche une citation sourcée (œuvre, passage, score de similarité) |
| `ChatInput` | Champ de saisie + sélecteur d'œuvre optionnel + bouton envoi |
| `TypingIndicator` | Animation pendant le streaming de la réponse |
| `ModeSelector` | Choix du mode (érudit / apprentissage / jeune) |
| `AuthorSelector` | Choix de l'auteur (Victor Hugo, Émile Zola, Jules Verne) |
| `WorkFilter` | Filtre optionnel par œuvre (dropdown avec les œuvres de l'auteur sélectionné) |

### Rendu des réponses

Les réponses de l'assistant doivent :
- Être rendues en **Markdown** (react-markdown + remark-gfm)
- Afficher les **citations** avec l'œuvre source, cliquables pour déplier le passage complet
- Utiliser une **police serif** pour les extraits littéraires
- Différencier visuellement le texte de l'assistant vs les citations du corpus

### Streaming

RAGFlow supporte le streaming SSE via `"stream": true` dans les completions.
Le hook `useChat` doit parser le flux SSE et mettre à jour l'affichage en temps réel.

---

## 14. Intégration RAGFlow

### Datasets (un par auteur)

| Auteur | Dataset ID | Documents | Chunk Method |
|--------|-----------|-----------|--------------|
| Victor Hugo | `14ef8d8e271611f1a5a87db1341041f4` | 125 | book |
| Émile Zola | À créer | 816 | book |
| Jules Verne | À créer | 2073 | book |

### Chat Assistants (un par auteur)

Chaque auteur a un assistant RAGFlow avec :
- Le dataset de l'auteur attaché
- Un prompt système incluant `{knowledge}` et `{mode}`
- `empty_response` configuré pour éviter les hallucinations
- `show_quote: true` pour les citations

Le **mode** (`erudit` / `apprentissage` / `jeune`) est passé comme variable custom dans le body de la requête completions.

### Métadonnées documentaires

Chaque document dans RAGFlow porte les métadonnées suivantes (à pousser après indexation) :

| Champ | Exemple |
|-------|---------|
| `oeuvre` | `Les Misérables` |
| `slug_oeuvre` | `les-miserables` |
| `type` | `oeuvre-complete` / `chapitre` |
| `section` | `Chapitre 01` |
| `genre` | `roman` / `poesie` / `theatre` |
| `annee` | `1862` |

Ces métadonnées permettent le **filtrage par œuvre/genre** à chaque requête via `metadata_condition`.

### Sécurité API

La clé `RAGFLOW_ADMIN_API_KEY` ne doit **jamais** être exposée côté client.

Nginx injecte le header d'auth côté serveur pour les requêtes proxiées vers RAGFlow. Comme Nginx ne résout pas les variables d'environnement nativement dans ses fichiers de config, on utilise `envsubst` au démarrage du container pour injecter la clé depuis l'environnement dans le fichier de config (voir [§17 Docker](#17-docker--déploiement)).

### Rate Limiting

La protection contre les abus est gérée directement par Nginx, sans service supplémentaire. Deux niveaux de rate limiting sont appliqués sur le proxy RAGFlow :

| Zone | Clé | Limite | Burst | But |
|------|-----|--------|-------|-----|
| `ragflow_per_user` | Cookie PocketBase (`$cookie_pb_auth`) | 5 req/min | 10 | Quota par utilisateur authentifié |
| `ragflow_global` | Adresse IP (`$binary_remote_addr`) | 30 req/min | 15 | Filet de sécurité global |

5 requêtes/minute par utilisateur est raisonnable pour un chat littéraire (une question toutes les 12 secondes). Le `burst` permet une rafale occasionnelle sans rejet.

Si un besoin de quotas par utilisateur apparaît plus tard (plan gratuit vs premium), un hook PocketBase incrémentant un compteur en base sera la bonne approche. Pour la protection contre les abus, Nginx suffit.

---

## 15. PocketBase Backend

### Collections

#### `users` (type: auth)

Collection d'authentification intégrée PocketBase.

| Champ | Type | Description |
|-------|------|-------------|
| email | email | Login |
| name | text | Nom affiché |
| avatar | file | Photo de profil (optionnel) |
| role | select (`user`, `admin`) | Rôle |

#### `preferences`

| Champ | Type | Description |
|-------|------|-------------|
| user_id | relation → users | 1:1 |
| default_mode | select (`erudit`, `apprentissage`, `jeune`) | Mode par défaut |
| default_author | text | Slug de l'auteur préféré |
| language | select (`fr`, `en`) | Langue de l'interface |
| theme | select (`light`, `dark`, `system`) | Thème |

#### `conversations`

Références aux sessions RAGFlow, stockées dans PocketBase pour l'historique utilisateur.

| Champ | Type | Description |
|-------|------|-------------|
| user_id | relation → users | Propriétaire |
| ragflow_chat_id | text | ID de l'assistant RAGFlow |
| ragflow_session_id | text | ID de la session RAGFlow |
| author_slug | text | `victor-hugo`, `emile-zola`, `jules-verne` |
| mode | select | Mode utilisé |
| title | text | Titre auto-généré ou donné par l'utilisateur |
| last_message_at | date | Pour le tri |
| message_count | number | Compteur |

### API Rules

| Collection | List | View | Create | Update | Delete |
|------------|------|------|--------|--------|--------|
| users | `@request.auth.id = id` | `@request.auth.id = id` | — | `@request.auth.id = id` | `null` |
| preferences | `user_id = @request.auth.id` | `user_id = @request.auth.id` | `@request.auth.id != ""` | `user_id = @request.auth.id` | `null` |
| conversations | `user_id = @request.auth.id` | `user_id = @request.auth.id` | `@request.auth.id != ""` | `user_id = @request.auth.id` | `user_id = @request.auth.id` |

### Client PocketBase

```typescript
import PocketBase from 'pocketbase';

const PB_URL = import.meta.env.VITE_POCKETBASE_URL;
if (!PB_URL) throw new Error('VITE_POCKETBASE_URL is not defined');

export const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);
```

---

## 16. Internationalisation (i18n)

### Configuration

```typescript
i18n.use(LanguageDetector).use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  fallbackLng: 'fr',
  supportedLngs: ['fr', 'en'],
  detection: {
    order: ['localStorage', 'navigator'],
    caches: ['localStorage'],
    lookupLocalStorage: 'vox-libris-language',
  },
  interpolation: { escapeValue: false },
});
```

### Structure des traductions

```json
{
  "common": { "loading", "send", "cancel", "newConversation", ... },
  "auth": { "login", "logout", "register", ... },
  "chat": { "placeholder", "thinking", "noResults", "citation", ... },
  "modes": {
    "erudit": { "name", "description" },
    "apprentissage": { "name", "description" },
    "jeune": { "name", "description" }
  },
  "authors": { "victorHugo", "emileZola", "julesVerne", ... },
  "navigation": { "chat", "authors", "history", "settings" }
}
```

---

## 17. Docker & Déploiement

### Architecture

RAGFlow est **déjà déployé** sur le VPS OVH (`docker-ragflow-cpu-1` dans `/opt/ragflow/docker`).
Ce docker-compose ajoute **PocketBase + Nginx** à côté.

```yaml
# docker/docker-compose.yml
services:
  pocketbase:
    image: ghcr.io/muchobien/pocketbase:latest
    container_name: voxlibris-pocketbase
    restart: unless-stopped
    ports:
      - "127.0.0.1:8090:8090"
    volumes:
      - pb_data:/pb/pb_data
      - ./pocketbase/pb_migrations:/pb/pb_migrations
      - ./pocketbase/pb_hooks:/pb/pb_hooks
    environment:
      - PB_ENCRYPTION_KEY=${PB_ENCRYPTION_KEY:-}
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8090/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    container_name: voxlibris-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    environment:
      - RAGFLOW_ADMIN_API_KEY=${RAGFLOW_ADMIN_API_KEY}
    volumes:
      - ./nginx/default.conf.template:/etc/nginx/templates/default.conf.template:ro
      - frontend_dist:/usr/share/nginx/html:ro
    # envsubst remplace ${RAGFLOW_ADMIN_API_KEY} dans le template
    # puis lance Nginx avec la config générée
    command: >
      sh -c "envsubst '$$RAGFLOW_ADMIN_API_KEY'
      < /etc/nginx/templates/default.conf.template
      > /etc/nginx/conf.d/default.conf
      && nginx -g 'daemon off;'"
    depends_on:
      pocketbase:
        condition: service_healthy

volumes:
  pb_data:
    driver: local
  frontend_dist:
    driver: local
```

### Nginx — Reverse proxy avec auth et rate limiting

Le fichier de config Nginx est un **template** (`default.conf.template`). Au démarrage du container, `envsubst` remplace `${RAGFLOW_ADMIN_API_KEY}` par la vraie clé depuis l'environnement Docker, puis écrit le résultat dans `default.conf`.

```nginx
# docker/nginx/default.conf.template

# ── Rate Limiting ─────────────────────────────────────────────
# Par utilisateur authentifié (cookie PocketBase)
limit_req_zone $cookie_pb_auth zone=ragflow_per_user:10m rate=5r/m;
# Filet de sécurité global par IP
limit_req_zone $binary_remote_addr zone=ragflow_global:5m rate=30r/m;

server {
    listen 80;
    server_name voxlibris.cappasoft.cloud;

    root /usr/share/nginx/html;
    index index.html;

    # ── Compression ───────────────────────────────────────────
    gzip on;
    gzip_types text/plain text/css application/json application/javascript
               text/javascript image/svg+xml;
    gzip_min_length 256;

    # ── PocketBase API ────────────────────────────────────────
    location /api/pb/ {
        rewrite ^/api/pb/(.*) /api/$1 break;
        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # SSE (PocketBase Realtime) support
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # ── PocketBase Admin UI ───────────────────────────────────
    location /_/ {
        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ── RAGFlow API (clé injectée, rate limited) ──────────────
    location /api/rf/ {
        # Rate limiting : 5 req/min par user, burst de 10
        limit_req zone=ragflow_per_user burst=10 nodelay;
        # Rate limiting : 30 req/min par IP (filet global)
        limit_req zone=ragflow_global burst=15 nodelay;
        limit_req_status 429;

        rewrite ^/api/rf/(.*) /api/$1 break;
        proxy_pass http://127.0.0.1:8080;

        # Clé API injectée par envsubst au démarrage
        proxy_set_header Authorization "Bearer ${RAGFLOW_ADMIN_API_KEY}";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # SSE streaming pour les réponses LLM
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # ── Static assets (cache long) ────────────────────────────
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # ── SPA fallback ──────────────────────────────────────────
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# ── TLS (décommenter pour production avec Let's Encrypt) ──────
# server {
#     listen 443 ssl http2;
#     server_name voxlibris.cappasoft.cloud;
#     ssl_certificate /etc/letsencrypt/live/voxlibris.cappasoft.cloud/fullchain.pem;
#     ssl_certificate_key /etc/letsencrypt/live/voxlibris.cappasoft.cloud/privkey.pem;
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers HIGH:!aNULL:!MD5;
#     # ... mêmes locations que ci-dessus ...
# }
#
# server {
#     listen 80;
#     server_name voxlibris.cappasoft.cloud;
#     return 301 https://$host$request_uri;
# }
```

### Variables d'environnement serveur

| Variable | Scope | Injection | Description |
|----------|-------|-----------|-------------|
| `VITE_POCKETBASE_URL` | Frontend | Build-time (Vite) | `/api/pb` en prod, `http://localhost:8090` en dev |
| `VITE_RAGFLOW_URL` | Frontend | Build-time (Vite) | `/api/rf` en prod, `http://localhost:8080` en dev |
| `RAGFLOW_ADMIN_API_KEY` | Nginx | Runtime (envsubst) | Clé API RAGFlow, jamais dans le frontend |
| `PB_ENCRYPTION_KEY` | PocketBase | Runtime (env Docker) | Chiffrement SQLite |

Le fichier `.env` à la racine du déploiement serveur contient les secrets runtime :

```bash
# /opt/vox-libris/.env (serveur uniquement, pas versionné)
RAGFLOW_ADMIN_API_KEY=ragflow-...
PB_ENCRYPTION_KEY=...
```

Docker Compose charge automatiquement ce `.env` et le propage aux containers.

### Workflow de déploiement

```bash
# Sur le serveur
cd /opt/vox-libris
git pull

# Build frontend avec les URLs de production
VITE_POCKETBASE_URL=/api/pb VITE_RAGFLOW_URL=/api/rf npm run build

# Copier le build dans le volume Nginx
docker compose -f docker/docker-compose.yml up nginx -d --no-recreate 2>/dev/null || true
docker cp dist/. voxlibris-nginx:/usr/share/nginx/html/

# Redémarrer PocketBase (hooks + migrations)
docker compose -f docker/docker-compose.yml up pocketbase -d --force-recreate

# Recharger Nginx (relance envsubst + nginx)
docker compose -f docker/docker-compose.yml up nginx -d --force-recreate
```

### Ce qui se passe à chaque type de changement

| Modification | Action | DB touchée ? |
|-------------|--------|-------------|
| Code React | `npm run build` → copie dans Nginx | Non |
| `pb_hooks/*.pb.js` | Restart PocketBase | Non |
| `pb_migrations/*.js` | Restart PocketBase → applique les nouvelles migrations | Oui (ajouts) |
| `default.conf.template` | Recreate Nginx (relance envsubst) | Non |
| Clé RAGFlow dans `.env` | Recreate Nginx (relance envsubst) | Non |

---

## 18. Conventions de Code

### Nommage

| Élément | Convention | Exemple |
|---------|-----------|---------|
| Composants | PascalCase | `ChatWindow`, `AuthorSelector` |
| Hooks | camelCase avec `use` | `useChat`, `usePreferences` |
| Services | camelCase + `.service.ts` | `ragflow.service.ts` |
| Schemas | camelCase + `.schema.ts` | `chat.schema.ts` |
| Types | PascalCase | `ChatMessage`, `RagflowChunk` |
| Pages | PascalCase + `Page` | `ChatPage`, `HistoryPage` |

### Imports

- Path alias : `@/` pour `src/`
- Barrel exports dans `services/index.ts`
- Lazy imports pour les pages

### Commentaires

- Pas de commentaires évidents
- Documenter uniquement l'intention non-évidente, les trade-offs, les contraintes

### UX obligatoire

- Spinner `Loader2 animate-spin` sur tout bouton async
- `disabled={isLoading}` pour éviter les double-clics
- Toast typé (`success`, `error`) après chaque action
- Animation `animate-fade-in` sur les pages
- Indicateur de frappe pendant le streaming IA

---

*Document créé le 2026-03-23 pour le projet Vox Libris — architecture PocketBase + RAGFlow + Docker (Nginx)*
