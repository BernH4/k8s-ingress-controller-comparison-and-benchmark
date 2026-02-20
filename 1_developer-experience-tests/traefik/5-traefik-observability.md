---
shell: bash
---

# Traefik: Exportable Observability (Logging, Metrics, Tracing)

**Prerequisites:**

- Traefik installed and set up as described in `1-traefik-setup.md`.

**Documentation:**

- https://doc.traefik.io/traefik/observe/metrics/
- https://doc.traefik.io/traefik/observe/logs-and-access-logs/
- https://doc.traefik.io/traefik/observe/tracing/

## Metrics

Metrics in Prometheus format are enabled by default and can be scraped from port 9100:

```sh
# Will open port to a random Traefik pod that is part of the deployment
kubectl port-forward -n traefik deployment/traefik 9100:9100
```

Metrics are now visible at: http://localhost:9100/metrics

## Logs

Access logs are disabled by default and need to be enabled via Helm chart values.
See `production/values-production.yml`.

## Traces

Traces are disabled by default and need to be enabled via Helm chart values.
See `production/values-production.yml`.

Deploy Grafana Tempo as storage for traces. Traefik is configured to push traces to Tempo in `production/values-production.yml`.

```sh
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install Tempo 
helm install tempo grafana/tempo --namespace monitoring --create-namespace --version=1.24.1
```

Once a few requests have been made, traces are available to be queried from Tempo:

```sh
kubectl port-forward service/tempo -n monitoring 3200:3200

```

```sh
curl -g -s "http://localhost:3200/api/search?q={}" | jq '.traces'
```

Insert any TraceID obtained from the previous command:

```sh
curl -s "http://localhost:3200/api/traces/<TRACEID>" | jq
```
