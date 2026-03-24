# Instructions Agent — Accès distant à l'instance RAGFlow CivicForge

Ce document est conçu pour être copié-collé dans un autre projet afin de permettre à un agent d'interagir avec l'instance RAGFlow hébergée pour CivicForge, à la fois en SSH sur le VPS et via l'API HTTP.

Il décrit les accès, les commandes de validation, les règles de prudence et l'état actuel du déploiement.

## Identité de l'instance

- Produit : `RAGFlow`
- URL canonique : `https://ragflow.cappasoft.cloud`
- Alias de compatibilité : `https://openrag.cappasoft.cloud`
- Accès direct IP : `http://66.70.191.163`
- VPS OVH : `vps-169b02f7.vps.ovh.ca`
- IPv4 : `66.70.191.163`
- IPv6 : `2607:5300:205:200::99e8`
- Utilisateur SSH : `ubuntu`

## Secrets attendus côté agent

Ne pas committer ces valeurs dans le dépôt cible. Les injecter via variables d'environnement, secret manager, vault, `.env.local` non versionné, ou configuration de l'agent.

Variables attendues :

```bash
VPS_HOSTNAME=vps-169b02f7.vps.ovh.ca
VPS_IPV4=66.70.191.163
VPS_SSH_USER=ubuntu
VPS_SSH_PASSWORD=<mot-de-passe-ssh-si-pas-de-cle>

RAGFLOW_BASE_URL=https://ragflow.cappasoft.cloud
RAGFLOW_ADMIN_API_KEY=ragflow-<token>
RAGFLOW_ADMIN_EMAIL=<email-admin-si-login-ui-necessaire>
RAGFLOW_ADMIN_PASSWORD=<mot-de-passe-ui-si-login-ui-necessaire>
```

Préférer une clé SSH à `VPS_SSH_PASSWORD` quand c'est possible.

## Accès SSH

Connexion recommandée :

```bash
ssh ubuntu@vps-169b02f7.vps.ovh.ca
```

Fallback :

```bash
ssh ubuntu@66.70.191.163
```

Le compte `ubuntu` dispose de `sudo`.

## Emplacement réel du déploiement

Le déploiement Docker Compose RAGFlow vit ici :

```bash
/opt/ragflow/docker
```

Le conteneur principal observé est :

```bash
docker-ragflow-cpu-1
```

Le projet Compose est nommé :

```bash
docker
```

## Commandes SSH utiles

```bash
ssh ubuntu@vps-169b02f7.vps.ovh.ca

cd /opt/ragflow/docker
docker compose ps
docker compose images
docker logs docker-ragflow-cpu-1 --tail 100 -f
sudo systemctl status nginx --no-pager
sudo nginx -t
sudo nginx -T
```

Pour vérifier rapidement la version déployée :

```bash
sudo git -C /opt/ragflow describe --tags --always
docker compose images
```

## API HTTP

Base URL :

```bash
https://ragflow.cappasoft.cloud/api/v1/
```

Authentification :

```bash
Authorization: Bearer $RAGFLOW_ADMIN_API_KEY
```

Exemples :

```bash
curl -s https://ragflow.cappasoft.cloud/api/v1/datasets \
  -H "Authorization: Bearer $RAGFLOW_ADMIN_API_KEY" \
  -H "Content-Type: application/json"
```

```bash
curl -s https://ragflow.cappasoft.cloud/api/v1/chats \
  -H "Authorization: Bearer $RAGFLOW_ADMIN_API_KEY" \
  -H "Content-Type: application/json"
```

```bash
curl -s https://ragflow.cappasoft.cloud/api/v1/retrieval \
  -H "Authorization: Bearer $RAGFLOW_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "test",
    "dataset_ids": [],
    "keyword": true,
    "top_k": 5
  }'
```

## Vérifications minimales qu'un agent doit savoir faire

### 1. Vérifier que le site répond

```bash
curl -I https://ragflow.cappasoft.cloud/
```

Résultat attendu : `HTTP 200`.

### 2. Vérifier la redirection HTTP vers HTTPS

```bash
curl -I http://ragflow.cappasoft.cloud/
```

Résultat attendu : `HTTP 301`.

### 3. Vérifier l'API admin

```bash
curl -s https://ragflow.cappasoft.cloud/api/v1/datasets \
  -H "Authorization: Bearer $RAGFLOW_ADMIN_API_KEY"
```

Résultat attendu : réponse JSON avec `code: 0`.

### 4. Vérifier les conteneurs côté VPS

```bash
ssh ubuntu@vps-169b02f7.vps.ovh.ca \
  "cd /opt/ragflow/docker && docker compose ps"
```

Résultat attendu : `ragflow-cpu`, `mysql`, `redis`, `minio`, `es01` en état `Up`.

## Contraintes d'exploitation

- Le reverse proxy public est géré par `nginx` sur le VPS.
- Le proxy public doit pointer vers le nginx interne RAGFlow, pas directement vers `9380`.
- RAGFlow expose l'UI et l'API via le port web interne monté sur `127.0.0.1:8080` côté serveur public.
- Ne jamais faire `docker compose down -v` sans confirmation explicite : cela supprime les volumes.
- Si `.env` Docker est modifié, `docker compose restart` ne suffit pas ; il faut recréer les services.

## Procédure sûre pour changements côté serveur

Avant toute modification :

```bash
ssh ubuntu@vps-169b02f7.vps.ovh.ca
cd /opt/ragflow/docker

BACKUP_DIR="$HOME/ragflow-agent-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp .env "$BACKUP_DIR"/
cp docker-compose.yml "$BACKUP_DIR"/ 2>/dev/null || true
docker compose config > "$BACKUP_DIR/docker-compose.resolved.yml"
docker compose ps > "$BACKUP_DIR/docker-compose.ps.txt"
docker compose images > "$BACKUP_DIR/docker-compose.images.txt"
```

Après modification :

```bash
docker compose pull
docker compose up -d --force-recreate
docker compose ps
docker logs docker-ragflow-cpu-1 --tail 200
```

## État actuel observé

- Version Git / image : `v0.24.0`
- Image principale : `infiniflow/ragflow:v0.24.0`
- Tag stable publié le plus récent observé : `v0.24.0`
- Tag `nightly` disponible, mais pré-release
- Dépôt serveur local : `HEAD detached`
- Fichier local modifié côté serveur : `/opt/ragflow/docker/.env`

## Évaluation mise à jour

Conclusion actuelle :

- Oui, la procédure d'upgrade Docker Compose est techniquement faisable.
- Non, il n'y a pas de nouvelle release stable publiée à appliquer au moment de cet audit.
- Donc une mise à jour vers une version stable plus récente n'est pas pertinente pour l'instant.
- Une bascule vers `nightly` serait possible, mais non recommandée sans besoin précis et fenêtre de test dédiée.

## Références utiles

- `specs/generated-docs/2026-03-24-ragflow-domain-correction/README.md`
- `specs/generated-docs/2026-03-23-openrag-ssl-nginx-deployment/README.md`
- `.cursor/rules/104-ragflow.mdc`
- `specs/learnings/infrastructure-deployment.md`
- `specs/learnings/ragflow-api.md`
