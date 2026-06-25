# Deploying kieranklaassen.com

The production image runs Rails, Thruster, and the Inertia Node SSR process in
one container. Puma's `inertia_ssr` plugin starts, monitors, and gracefully
stops the renderer. Kamal 2.12 routes traffic only after Rails answers `/up`.

## Configure the deployment

Copy the environment template and replace every placeholder:

```bash
cp .kamal/deploy.env.example .kamal/deploy.env
```

Keep `KAMAL_SERVICE` stable after the first deploy. Changing it creates a
separate Kamal application. `KAMAL_IMAGE` is relative to the registry server;
for GHCR it has the shape `github-user/kieranklaassen-com`.

Resolve these values from the shell or a password manager in `.kamal/secrets`:

```bash
KAMAL_REGISTRY_PASSWORD=$KAMAL_REGISTRY_PASSWORD
RAILS_MASTER_KEY=$RAILS_MASTER_KEY
```

Both local files are ignored by Git. Never commit registry tokens, the Rails
master key, SSH private keys, or production environment files.

Point every `KAMAL_PROXY_HOSTS` DNS name at a configured server before the first
TLS-enabled deploy.

## First deployment

```bash
set -a
source .kamal/deploy.env
set +a

bin/kamal config
bin/kamal setup
```

## Subsequent deployments

```bash
set -a
source .kamal/deploy.env
set +a

bin/kamal deploy
```

After deployment, verify Rails readiness and SSR separately. `/up` proves Rails
booted; article prose in the raw response proves the Node renderer is healthy:

```bash
curl --fail --silent "https://kieranklaassen.com/up"
curl --fail --silent \
  "https://kieranklaassen.com/creativity,/breathwork/2025/04/11/unlocking-ideas/" \
  | grep --fixed-strings "conscious breathing"
```

If the second check fails, the site remains available through Inertia's client
rendering fallback. Inspect `bin/kamal logs`, correct the SSR image or runtime,
and redeploy before considering the rollout verified.

## Roll back

List available releases and redeploy the last known-good image:

```bash
bin/kamal app containers
bin/kamal rollback <VERSION>
```
