# Déploiement gratuit (démo) — Neon + Render + Vercel

| Partie | Hébergeur (free) | URL obtenue |
|---|---|---|
| Base de données PostgreSQL | **Neon** | (privée) |
| Backend Odoo 19 + `training_management` | **Render** (Docker) | `https://training-platform-odoo.onrender.com` |
| Frontend Next.js | **Vercel** | `https://<projet>.vercel.app` |

Le navigateur parle uniquement à Vercel ; Next.js proxifie `/api/v1/*` vers Odoo
(`ODOO_INTERNAL_BASE_URL`, voir `frontend/next.config.ts`). Pas de CORS à configurer.

## 1. Neon (PostgreSQL)

1. Créer un compte sur https://neon.tech → **New project** (région Europe, Frankfurt).
2. **Connect** → décocher *Connection pooling* (Odoo a besoin d'une connexion directe).
3. Noter : host (`ep-xxx.eu-central-1.aws.neon.tech`), user (`neondb_owner`),
   password, database (`neondb`).

## 2. Render (backend Odoo)

1. https://render.com → se connecter avec GitHub.
2. **New → Blueprint** → choisir le repo `training-platform`, branche `main`
   (le fichier `render.yaml` est détecté).
3. Remplir : `DB_HOST`, `DB_USER`, `DB_PASSWORD` (valeurs Neon). `DB_NAME` = `neondb`.
4. **Apply**. Le premier démarrage installe la base (base → addon) : compter
   10–20 min sur le plan free. Suivre les **Logs**.
5. Tester : `https://<service>.onrender.com/web/health` → `{"status": "pass"}`,
   puis `https://<service>.onrender.com/web/login`.
6. Mot de passe initial : login `admin` / `admin` → **le changer tout de suite**
   (Préférences). Le mot de passe maître (`ADMIN_PASSWD`) est généré par Render.
7. Pour charger les données de démo : depuis la machine locale,
   `scripts/load_dev_data.sh` en pointant vers Neon, ou créer les données dans le back-office.

Mise à jour du code de l'addon : ajouter la variable `UPDATE_MODULES=training_management`
le temps d'un déploiement, puis la retirer.

## 3. Vercel (frontend)

1. https://vercel.com → **Add New → Project** → importer `training-platform`.
2. **Root Directory** : `frontend` (Framework : Next.js, détecté).
3. Environment Variables :
   - `ODOO_INTERNAL_BASE_URL` = `https://<service>.onrender.com`
   - `NEXT_PUBLIC_DEFAULT_LOCALE` = `ar`
   - `NEXT_PUBLIC_SUPPORT_EMAIL` = votre email
4. **Deploy** → URL `https://<projet>.vercel.app`.

## Limites du gratuit (à connaître)

- **Render free** : 512 Mo RAM, le service s'endort après 15 min sans trafic ;
  la première requête suivante prend ~1 min. Pas de disque persistant →
  les pièces jointes sont stockées en base (`ir_attachment.location = db`, fait
  automatiquement par `deploy/odoo/entrypoint.sh`).
- **Neon free** : stockage limité (0,5 Go environ) ; la base se met en pause quand inactive.
- **Vercel Hobby** : usage non commercial uniquement.
- Emails (mot de passe oublié, rappels) : configurer un serveur SMTP sortant dans
  Odoo (Paramètres → Serveurs de messagerie sortants), sinon ils ne partent pas.

Pour la production : passer à un VPS (Docker Compose) ou aux plans payants.
