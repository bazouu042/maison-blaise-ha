# maison-blaise-ha

Workflow Mistral géré : « le chat » pilote Home Assistant (Maison Blaise) à distance via le tunnel Cloudflare (ha.bazouu-lab.fr), protégé par Cloudflare Access.

- Workflow : `ha-command` — appelle l'API REST de Home Assistant avec les 3 badges (jeton HA + Client ID/Secret Cloudflare Access).
- Les secrets (HA_BEARER_TOKEN, CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET) sont fournis par le Secrets Manager du workspace Mistral, jamais commités ici.
- Déployé en tant que managed deployment Mistral Cloud.
