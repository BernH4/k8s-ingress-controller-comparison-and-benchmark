---
shell: bash
---

# Envoy: Exportable Observability (Logging, Metrics, Tracing)

A Observability Stack will be deployed according to Envoy Gateway documentation.

**Prerequisites:**
- Envoy Gateway installed and setup as described in `1-envoy-gw-setup.md`. 

**Documentation used:**
- Enable [Gateway API Metrics](https://gateway.envoyproxy.io/docs/tasks/observability/gateway-api-metrics/)

Both the control and the data plane expose metrics by default on Port 19001, for better usability a Observability stack can be installed.

Envoy Gateway provides an add-ons Helm chart to simplify the installation of observability components:

```sh
helm install eg-addons oci://docker.io/envoyproxy/gateway-addons-helm --version v1.6.1 --set opentelemetry-collector.enabled=true -n monitoring --create-namespace

```

This helm chart installed Prometheus, Loki, Tempo, Fluent-Bit and Grafana:

```sh
kubectl get pods -n monitoring
```

Make Grafana available locally:

```sh
export GRAFANA_PORT=$(kubectl get service grafana -n monitoring -o jsonpath='{.spec.ports[0].port}')
kubectl port-forward service/grafana -n monitoring 3000:$GRAFANA_PORT

```

Grafana is now be reachable at http://localhost:3000/dashboards in the browser. Dashboards for both Control- and DataPlane are already configured.

Username: admin

Password: admin


## Envoy Gateway Metrics 

The Control Plane and Data Plane provides scrapable metrics by default.
Those metrics can be viewed in the Grafana Dashboard "Envoy Gateway Global" for Control Plane and "Envoy Clusters" and "Envoy Global" for Data Plane.

## Gateway API related Metrics 

Metrics regarding Gateway API can be activated too.

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

Gateway API related metrics can now be queried, e.g. the number of attached routes to our gateway:

```sh
curl -s http://localhost:9090/api/v1/query \
  --data-urlencode 'query=sum(gatewayapi_gateway_status_listener_attached_routes{name=~"gateway"})' 

```

Alternatively, access the Prometheus UI at http://localhost:9090

Additionally in the [documentation](https://gateway.envoyproxy.io/docs/tasks/observability/gateway-api-metrics/#dashboards) there are examples how to import preconfigured dashboards to grafana for Gateway API related metrics.

## Logs

The Observability stack included Loki, which is collecting logs that can be queried:

```sh
kubectl port-forward -n monitoring svc/loki 3100:3100
```

```sh
curl -s "http://localhost:3100/loki/api/v1/query_range" --data-urlencoVde "query={job=\"fluentbit\"}" | jq '.data.result[0].values'
```

## Traces

Documentation used: https://gateway.envoyproxy.io/docs/tasks/observability/proxy-trace/#traces

OTEL Tracing was enabled in `envoyproxy.yml`, traces can be viewed in Grafana (tempo has to be added as datasource first) or via curl (make sure you stop earlier port-forward)

```sh
kubectl port-forward service/tempo -n monitoring 3100:3100

```

```sh
curl -s "http://localhost:3100/api/search?tags=component%3Dproxy+provider%3Dotel" | jq .traces
```

Insert any TraceID gotten from previous command:

```sh
curl -s "http://localhost:3100/api/traces/<TRACEID>" | jq
```
