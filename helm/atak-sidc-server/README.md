# atak-sidc-server Helm chart

Deploys the NATO APP-6 / MIL-STD-2525 symbol server on Kubernetes.

## Install

```bash
helm upgrade --install atak-sidc ./helm/atak-sidc-server \
  --namespace atak --create-namespace \
  -f ./helm/atak-sidc-server/values.override.yaml
```

`values.yaml` is the committed baseline — leave it alone. Everything
environment-specific belongs in `values.override.yaml`, so an upgrade stays a
one-liner and the diff between environments is one short file.

Verify:

```bash
kubectl -n atak rollout status deploy/atak-sidc-atak-sidc-server
helm test atak-sidc -n atak     # curls /api/health through the Service
```

Roll back:

```bash
helm rollback atak-sidc -n atak
```

## Defaults worth knowing

| Default | Why |
| --- | --- |
| `replicaCount: 3` | Survives one node failure *and* one voluntary disruption while still serving. |
| `podDisruptionBudget.minAvailable: 2` | A node drain evicts one pod at a time; two stay up. Rendering fails loudly if replicas drop below 2 with the PDB on. |
| `maxUnavailable: 0`, `maxSurge: 1` | Upgrades add a pod before removing one — no capacity dip. |
| `lifecycle.preStop: sleep 5` | Endpoint removal and SIGTERM race each other; sleeping first is what stops rolling upgrades from emitting 502s. |
| `image.pullPolicy: IfNotPresent` | Cached layers mean instant restarts and a registry outage can't block rescheduling. Safe **only** with immutable tags — see below. |
| `image.tag: ""` → `Chart.appVersion` | A plain `helm install` pulls a pinned tag, never `:latest`. |
| `ingress.enabled: true`, `className: nginx` | ingress-nginx is the assumed edge. |
| `topologySpreadConstraints` (ScheduleAnyway) | Spreads across nodes but still schedules on a one-node cluster. |
| `service.secondary.enabled: false` | The image runs two PM2 listeners (8080/8081) of the same app; in Kubernetes replicas provide the redundancy, so only 8080 is published. |
| `serviceAccount.automountServiceAccountToken: false` | The app makes no Kubernetes API calls. |
| logs on an `emptyDir` | PM2 writes `/app/logs/*.log`; keeps that off the node's image filesystem. |

## Two things that will bite you

**Tags must be immutable.** `IfNotPresent` means a node that already has
`:1.2.3` never re-pulls it. Re-pushing a tag gives you a cluster running two
different builds under one version. Cut a new tag per release, or pin
`image.digest`. If you must use a moving tag, set `image.pullPolicy: Always`.

**Ports are pinned by `ecosystem.config.js`.** `containerPorts.http` /
`containerPorts.pm2` drive the ConfigMap, Service, probes and NetworkPolicy —
but PM2's per-app `env` block hardcodes 8080 and 8081 and wins over the
container environment. Changing the numbers here requires editing
`ecosystem.config.js` in the same commit, or the listeners won't move.

## Values

Everything is documented inline in [`values.yaml`](values.yaml). The values you
most often touch:

| Key | Default | Notes |
| --- | --- | --- |
| `image.registry` / `.repository` / `.tag` | `ghcr.io` / `jbelke/atak-sidc-server` / appVersion | `digest` overrides `tag`. |
| `replicaCount` | `3` | Ignored when `autoscaling.enabled`. |
| `ingress.host` | `atak-sidc.local` | **Placeholder — change it.** Use `ingress.hosts` for multi-host. |
| `ingress.tls` | `[]` | No TLS until you set it; `helm install` warns. |
| `env` | `NODE_ENV`, `NEXT_TELEMETRY_DISABLED` | Becomes a ConfigMap; pods roll on change. |
| `secretEnv` / `envFrom` | `{}` / `[]` | Secret values; prefer an external secret store via `envFrom`. |
| `resources` | 2Gi limit / 1Gi + 250m request | Mirrors docker-compose. No CPU limit on purpose. |
| `autoscaling.enabled` | `false` | HPA takes over replicas when on. |
| `networkPolicy.enabled` | `false` | Needs your ingress controller's namespace label. |
| `persistence.enabled` | `false` | The app is stateless; only for a future render cache. |

`values.schema.json` type-checks the error-prone keys at install time (pull
policy, service type, ports, path types). It allows unknown keys, so adding a
value doesn't mean editing the schema.

## Chart development

```bash
helm lint --strict ./helm/atak-sidc-server
helm template t ./helm/atak-sidc-server                  # default render
helm template t ./helm/atak-sidc-server -f values.override.yaml
helm diff upgrade atak-sidc ./helm/atak-sidc-server -n atak   # needs helm-diff
```

Bump `Chart.yaml: version` on any chart change, and `appVersion` together with
`package.json` + the pushed image tag on any application release.
