---
shell: bash
---

# Envoy: Exportable Observability (Logging, Metrics, Tracing)

An observability stack will be deployed according to the Envoy Gateway documentation.

**Prerequisites:**

- Envoy Gateway installed and set up as described in `1-envoy-gw-setup.md`.

**Documentation used:**

- Enable [Gateway API Metrics](https://gateway.envoyproxy.io/docs/tasks/observability/gateway-api-metrics/)

Both the control plane and the data plane expose metrics by default on port 19001. For better usability, an observability stack can be installed.

Envoy Gateway provides an add-on Helm chart to simplify the installation of observability components:

```sh
helm install eg-addons oci://docker.io/envoyproxy/gateway-addons-helm --version v1.6.1 --set opentelemetry-collector.enabled=true -n monitoring --create-namespace

```

This Helm chart installs Prometheus, Loki, Tempo, Fluent-Bit, and Grafana:

```sh
kubectl get pods -n monitoring
```

Make Grafana available locally:

```sh
export GRAFANA_PORT=$(kubectl get service grafana -n monitoring -o jsonpath='{.spec.ports[0].port}')
kubectl port-forward service/grafana -n monitoring 3000:$GRAFANA_PORT

```

Grafana is now reachable at http://localhost:3000/dashboards in the browser. Dashboards for both control plane and data plane are already configured.

Username: admin

Password: admin

## Envoy Gateway Metrics

The control plane and data plane provide scrapable metrics by default.
Those metrics can be viewed in the Grafana dashboards "Envoy Gateway Global" for the control plane, and "Envoy Clusters" and "Envoy Global" for the data plane.

## Gateway API-Related Metrics

Metrics related to the Gateway API can be activated as well.

The kube-state-metrics service is required to collect metrics from the Kubernetes API server. Use the following command to enable it:

```sh
helm upgrade eg-addons oci://docker.io/envoyproxy/gateway-addons-helm \
--version v1.6.1 \
--reuse-values \
--set prometheus.kube-state-metrics.enabled=true \
-n monitoring

```

```sh
export PROMETHEUS_PORT=$(kubectl get service prometheus -n monitoring -o jsonpath='{.spec.ports[0].port}')
kubectl port-forward service/prometheus -n monitoring 9090:$PROMETHEUS_PORT

```

Gateway API-related metrics can now be queried, e.g., the number of attached routes to the gateway:

```sh
curl -s http://localhost:9090/api/v1/query \
  --data-urlencode 'query=sum(gatewayapi_gateway_status_listener_attached_routes{name=~"gateway"})' 

```

Alternatively, access the Prometheus UI at http://localhost:9090

Additionally, the [documentation](https://gateway.envoyproxy.io/docs/tasks/observability/gateway-api-metrics/#dashboards) provides examples of how to import preconfigured dashboards into Grafana for Gateway API-related metrics.

## Logs

The observability stack includes Loki, which collects logs that can be queried:

```sh
kubectl port-forward -n monitoring svc/loki 3100:3100
```

```sh
curl -s "http://localhost:3100/loki/api/v1/query_range" --data-urlencode "query={job=\"fluentbit\"}" | jq '.data.result[0].values'
```

## Traces

Documentation used: https://gateway.envoyproxy.io/docs/tasks/observability/proxy-trace/#traces

OTEL tracing was enabled in `envoyproxy.yml`. Traces can be viewed in Grafana (Tempo has to be added as a data source first) or via curl (make sure to stop the earlier port-forward):

```sh
kubectl port-forward service/tempo -n monitoring 3100:3100

```

```sh
curl -s "http://localhost:3100/api/search?limit=5" | jq .traces
```

Insert any TraceID obtained from the previous command:

```sh
curl -s "http://localhost:3100/api/traces/<TRACEID>" | jq
```
