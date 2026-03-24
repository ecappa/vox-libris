# Synthèse RAGFlow — expérience utilisateur et recherche (Vox Libris)

Document de synthèse pour orienter le produit et l’intégration API. Instance : RAGFlow v0.24 (`https://ragflow.cappasoft.cloud`). Détail technique : `.cursor/skills/ragflow-api/SKILL.md` et `reference.md`.

## Objectifs rappelés

- Trois modes de dialogue : Érudit (citations, rigueur), Apprentissage (pédagogie), Jeune (accessibilité).
- Corpus : Victor Hugo, Émile Zola, Jules Verne ; granularité idéale chapitre (Zola/Verne) ; Hugo encore souvent en fichier œuvre complète.
- Besoin : réponses ancrées dans le texte, filtrage par auteur / œuvre / chapitre, et recherche exploitable côté UI.

## État actuel côté projet

- Jeu de données Hugo en place ; `meta_fields` souvent vides après upload alors que le frontmatter existe dans `data/markdown-rag/**/*.txt`.
- **Rerank** : un fournisseur de rerank est déjà configuré sur l’instance — à **réutiliser explicitement** dans les appels où la qualité du tri compte :
  - `POST /api/v1/retrieval` : paramètre `rerank_id` (selon la doc / UI RAGFlow pour l’identifiant du modèle).
  - Configuration de l’assistant (`/chats`) : modèle de rerank aligné sur celui déjà configuré, pour que les chunks passés au LLM soient reclassés après le premier passage hybride.

Sans `rerank_id` côté API, le provider configuré globalement peut ne pas s’appliquer partout selon la version ; vérifier dans l’UI assistant et dans les payloads de test.

## Levier 1 — `meta_fields` (priorité haute)

**But** : filtrer retrieval et chat par `auteur`, `oeuvre`, `slug_oeuvre`, `type`, `section`, puis enrichissements `genre`, `annee`, `periode` (voir tableau dans `reference.md`).

**API** : `PUT /api/v1/datasets/{dataset_id}/documents/{document_id}` avec un corps JSON contenant les métadonnées attendues par RAGFlow pour ce document. En v0.24, pas d’endpoint batch documenté pour métadonnées : mise à jour **document par document**.

**Faisabilité (automatisation)** : oui. Une approche standard :

1. Parser le YAML frontmatter des fichiers `data/markdown-rag/.../*.txt`.
2. Lister les documents du dataset (`GET .../datasets/{id}/documents`) et faire correspondre **nom de fichier** (ou champ `name` renvoyé par l’API) au fichier local.
3. Pour chaque paire, appeler `PUT` pour remplir `meta_fields` (ou équivalent selon le schéma exact renvoyé par l’API).

**Limites** : renommages de fichiers côté RAGFlow vs disque, pagination sur les listes, rate limiting ; pour Zola/Verne le volume est plus grand qu’Hugo seul — prévoir un script idempotent et des logs d’échecs.

## Levier 2 — Recherche avancée (priorité haute, bonne idée produit)

**Pourquoi c’est pertinent** : le chat répond en langage naturel ; une **recherche dédiée** (`POST /retrieval`) donne une liste de passages avec scores, ce qui sert :

- aux utilisateurs qui veulent **voir les sources** avant ou sans génération ;
- au mode Érudit (preuves textuelles) ;
- à l’exploration par requête précise (citations, vers, noms propres).

**Paramètres utiles** :

- `keyword: true` et `vector_similarity_weight` : équilibre BM25 / embedding (noms propres et formules exactes vs paraphrase).
- `highlight: true` : surlignage des correspondances dans l’UI.
- `metadata_condition` : mêmes filtres que le chat (œuvre, auteur, chapitre) pour cohérence avec les sélecteurs de l’application.
- `rerank_id` : tirer parti du rerank déjà configuré pour stabiliser le top des extraits sur les gros documents.

**UX suggérée** : écran ou panneau « Recherche dans le corpus » avec filtres (auteur, œuvre, chapitre si disponible), puis résultats type extraits + lien vers contexte ; le chat peut rester sur le même `dataset_ids` et les mêmes filtres.

## Levier 3 — Assistants et sessions

- Assistants `/chats` : prompt avec `{knowledge}` + variable `mode` (`erudit` / `apprentissage` / `jeune`) ; `show_quote: true`, `empty_response` explicite, `opener` adapté au public.
- `POST .../sessions` + `completions` avec `session_id` : continuité de conversation.
- `metadata_condition` dans le corps des `completions` : même logique que la recherche.

## Levier 4 — À tester ensuite

- `toc_enhance` sur corpus structuré (surtout si chunk `book` + titres exploitables).
- `cross_languages` si requêtes hors français.
- `use_kg` seulement si investissement dans un graphe de connaissances dans RAGFlow.

## Synthèse par priorité

| Priorité | Action | Effet |
|----------|--------|--------|
| Haute | Renseigner `meta_fields` depuis `markdown-rag` | Filtres fiables, moins de mélange entre œuvres |
| Haute | Recherche avancée via `/retrieval` + highlight + hybrid + **rerank** | UX « sources » et confiance (Érudit) |
| Haute | Aligner assistant sur rerank déjà configuré | Meilleurs extraits pour le LLM |
| Moyenne | Sessions + prompt multi-modes | Cohérence dialogue et pédagogie |
| Plus tard | `toc_enhance`, KG, cross-lang | Selon retours utilisateurs et découpage Hugo |

## Réponse aux questions ponctuelles

- **Rerank déjà configuré** : l’exploiter dans retrieval, assistants et tests de réglage (`similarity_threshold`, `top_n`) plutôt que de le laisser implicite seulement.
- **Peut-on remplir les `meta_fields` automatiquement ?** Oui, par script (frontmatter local + appels `PUT` par document), avec correspondance nom de fichier ↔ document RAGFlow.
- **La recherche avancée est-elle une bonne idée ?** Oui : complément naturel du chat, surtout pour Vox Libris et le mode Érudit.
