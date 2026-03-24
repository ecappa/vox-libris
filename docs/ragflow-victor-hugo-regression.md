# RAGFlow — Victor Hugo : référence et tests de non-régression

Ce document décrit l’état cible du corpus **Victor Hugo** sur RAGFlow, les identifiants stables à utiliser dans des tests automatisés, et des **cas de test** reproductibles. Il complète `docs/instruction-ragflow.md` (accès instance, secrets) et le skill `.cursor/skills/ragflow-api/`.

## Instance et authentification

| Élément | Valeur |
|---------|--------|
| API root | `https://ragflow.cappasoft.cloud/api/v1/` |
| Version cible | v0.24.x |
| En-tête | `Authorization: Bearer <RAGFLOW_ADMIN_API_KEY>` |

Chargement de la clé (éviter `source .env.local` à cause de `!` dans d’autres variables) :

```bash
export RAGFLOW_ADMIN_API_KEY=$(grep '^RAGFLOW_ADMIN_API_KEY=' .env.local | cut -d= -f2-)
export RAGFLOW_BASE_URL=https://ragflow.cappasoft.cloud/api/v1
```

Les tests ci-dessous supposent `RAGFLOW_ADMIN_API_KEY` défini.

## Identifiants Vox Libris (à paramétrer dans les tests)

Ces UUID peuvent changer si vous recréez dataset ou assistants ; centralisez-les dans votre suite de tests (variables d’environnement).

| Ressource | ID (état documenté mars 2026) |
|-----------|-------------------------------|
| Dataset **Victor Hugo** | `14ef8d8e271611f1a5a87db1341041f4` |
| Chat **mode érudit** | `9c9b99a8272011f1a5a87db1341041f4` |
| Chat **mode jeune** | `79a5a94a273c11f1a5a87db1341041f4` |

## Préconditions de non-régression

1. **Documents** : le dataset contient **125** documents ; statut d’indexation attendu : **`run: DONE`** pour tous (pas de `FAIL` non traité).
2. **Métadonnées** : chaque document a des `meta_fields` non vides, alignés sur le frontmatter des fichiers `data/markdown-rag/victor-hugo/*.txt` (script de sync ci-dessous).
3. **Description dataset** : texte descriptif Vox Libris présent (vérification optionnelle).

### Vérifier rapidement les compteurs (API)

```bash
curl -sS -G "$RAGFLOW_BASE_URL/datasets" \
  --data-urlencode "page=1" --data-urlencode "page_size=100" \
  -H "Authorization: Bearer $RAGFLOW_ADMIN_API_KEY" \
  | jq '.data[] | select(.name=="Victor Hugo") | {id, document_count, chunk_count, chunk_method, language, embedding_model}'
```

Compter les statuts `run` :

```bash
# Remplacer DATASET_ID
DATASET_ID=14ef8d8e271611f1a5a87db1341041f4
curl -sS -G "$RAGFLOW_BASE_URL/datasets/$DATASET_ID/documents" \
  --data-urlencode "page=1" --data-urlencode "page_size=200" \
  -H "Authorization: Bearer $RAGFLOW_ADMIN_API_KEY" \
  | jq '[.data.docs[].run] | group_by(.) | map({(.[0]): length}) | add'
```

### Synchroniser les métadonnées (réparation / après recréation dataset)

```bash
export RAGFLOW_ADMIN_API_KEY=$(grep '^RAGFLOW_ADMIN_API_KEY=' .env.local | cut -d= -f2-)
python3 data/scripts/08_sync_ragflow_hugo_metadata.py
```

Attendu : `{"updated": 125, "errors": 0, ...}`.

Champs poussés dans `meta_fields` : `auteur`, `slug_auteur`, `oeuvre`, `slug_oeuvre`, `type`, et si présents dans le YAML : `section`, `slug_section`.

**Note** : le champ `oeuvre` dans les fichiers source reprend souvent le **casse du fichier** (ex. titres en majuscules). Pour les filtres API, préférer **`slug_oeuvre`** (stable, minuscules, tirets).

## Configuration dataset (API)

Sur v0.24, `PUT /datasets/{id}` **n’accepte** en pratique que **`name`** et **`description`** ; les autres champs (`similarity_threshold`, `parser_config`, `language`, etc.) peuvent être rejetés avec *Extra inputs are not permitted*. Les réglages de retrieval conversationnels se portent surtout sur **chaque assistant** (prompt : `similarity_threshold`, `top_n`, `keyword`, etc.).

## Assistants chat (comportement attendu)

| Assistant | Rôle | Dataset attaché |
|-----------|------|-----------------|
| **Vox Libris — Victor Hugo (mode érudit)** | Analyse précise, citations, corpus uniquement | Victor Hugo |
| **Vox Libris — Victor Hugo (mode jeune)** | Ton accessible, explications de mots, corpus uniquement | Victor Hugo |

Variables de prompt déclarées :

- `{knowledge}` — injecté par RAGFlow (obligatoire).
- `{oeuvre}` — optionnelle ; passée dans le corps de `completions` sous la clé **`oeuvre`**.

## Flux API pour tests de chat

### 1. Créer une session

`POST /chats/{chat_id}/sessions` avec corps `{"name": "regression-..."}`.

Réponse : `code == 0`, récupérer `data.id` comme `session_id`.

### 2. Poser une question

`POST /chats/{chat_id}/completions` avec par exemple :

```json
{
  "question": "…",
  "stream": false,
  "session_id": "<session_id>",
  "oeuvre": "Les Misérables",
  "metadata_condition": {
    "logic": "and",
    "conditions": [
      {
        "name": "slug_oeuvre",
        "comparison_operator": "=",
        "value": "les-miserables"
      }
    ]
  }
}
```

**Assertions typiques** (non-régression) :

- `code == 0`.
- `data.answer` (ou champ équivalent renvoyé par votre version) est une chaîne non vide.
- Pour les questions **dans le corpus** : la réponse contient des marqueurs de référence du type `[ID:…]` si `show_quote` est activé, et les refs mentionnent le bon `document_name` (ex. `les-miserables.txt`).
- Pour les questions **hors corpus** : pas d’hallucination de faits ; message cohérent avec `empty_response` ou explication honnête (selon prompt).

### 3. Cas de test recommandés (catalogue)

| ID | Assistant | Question (résumé) | `metadata_condition` | Critères de succès |
|----|-----------|-------------------|----------------------|--------------------|
| T1 | jeune | Jean Valjean au début (2 phrases simples) | `slug_oeuvre` = `les-miserables` | Contenu aligné Faverolles / émondeur / vol de pain ; refs depuis `les-miserables*.txt` |
| T2 | jeune | Qui est Quasimodo ? (jamais lu le livre) | `slug_oeuvre` = `notre-dame-de-paris` | Ton accessible ; refs `notre-dame-de-paris.txt` |
| T3 | jeune | Hugo parle-t-il d’Instagram ? | aucun ou selon besoin | Refus clair / anachronisme expliqué ; pas de faux passages |
| T4 | érudit | Même thème que T1 avec exigence de précision | `slug_oeuvre` = `les-miserables` | Réponse plus dense, toujours ancrée corpus |
| T5 | jeune | Question suivante dans la **même** session | (idem T1 ou sans filtre) | `refine_multiturn` : cohérence avec l’historique |

Adaptez les libellés exacts des questions pour éviter le surapprentissage sur une seule formulation.

## Retrieval autonome (`POST /retrieval`)

Utile pour valider la recherche **sans** LLM.

**Assertion** : avec `dataset_ids` = Victor Hugo, sans filtre métadonnées, une question du type « Jean Valjean » retourne `code == 0` et une liste `data.chunks` non vide (seuils : `similarity_threshold` et `top_k` à calibrer).

**Quirk documenté** : avec un **`metadata_condition`** sur `slug_oeuvre`, l’endpoint `/retrieval` a pu retourner **0 chunk** alors que **`/chats/.../completions`** avec le même filtre retournait des chunks pertinents. En non-régression :

- soit tester le **filtrage par métadonnées via le chat** (chemin prioritaire pour Vox Libris) ;
- soit tester `/retrieval` **sans** filtre et contrôler manuellement `document_name` / métadonnées dans les chunks si exposées.

Si le comportement de `/retrieval` + filtre évolue dans une future version RAGFlow, mettre à jour cette section.

## Check-list manuelle UI (optionnelle)

1. Se connecter à `https://ragflow.cappasoft.cloud`.
2. Ouvrir le chat **mode jeune** (ou érudit).
3. Poser les questions T1–T3.
4. Vérifier affichage des citations / sources si activé.

## Fichiers du dépôt concernés

| Fichier | Rôle |
|---------|------|
| `data/scripts/08_sync_ragflow_hugo_metadata.py` | Sync frontmatter → `meta_fields` RAGFlow |
| `data/markdown-rag/victor-hugo/*.txt` | Source de vérité métadonnées + texte indexé |
| `.cursor/skills/ragflow-api/SKILL.md` | Référence API générale |
| `.cursor/skills/ragflow-api/reference.md` | Schéma métadonnées cible, prompts types |

## Automatisation suggérée

Pour une suite CI ou locale :

1. Variables : `RAGFLOW_ADMIN_API_KEY`, `RAGFLOW_BASE_URL`, `RAGFLOW_DATASET_VICTOR_HUGO`, `RAGFLOW_CHAT_JEUNE`, `RAGFLOW_CHAT_ERUDIT`.
2. Étapes : préconditions (compteurs + tous `DONE`) → création session → boucle sur les cas T1–T5 → assertions sur `code`, longueur de réponse, et sous-chaînes / regex optionnelles (noms de fichiers dans `reference`).
3. Ne pas committer la clé API ; utiliser secrets du CI ou `.env.local` ignoré par git.

---

*Document généré pour supporter les tests de non-régression Vox Libris / RAGFlow. À mettre à jour lors du recréation d’assistants ou de migration de version RAGFlow.*
