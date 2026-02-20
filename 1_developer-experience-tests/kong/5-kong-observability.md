---
shell: bash
---

# Kong: Exportable Observability (Logging, Metrics, Tracing)

Following the Kong documentation example, this will deploy a ServiceMonitor Kubernetes resource using the Kong Gateway Helm chart, then use a KongClusterPlugin to configure the Prometheus plugin for all services in the cluster.

**Prerequisites:**

- Kong installed and set up as described in `1-kong-setup.md`.

**Documentation:**

- https://developer.konghq.com/kubernetes-ingress-controller/observability/prometheus/
- https://developer.konghq.com/kubernetes-ingress-controller/observability/prometheus-grafana/
- https://developer.konghq.com/how-to/collect-metrics-logs-and-traces-with-opentelemetry/
- https://developer.konghq.com/plugins/opentelemetry/examples/traces/
- https://developer.konghq.com/plugins/prometheus/reference/

## Metrics

Install Prometheus and Grafana using the provided configuration file `5-kong-values-monitoring.yaml`:

```sh
kubectl create namespace monitoring
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install promstack prometheus-community/kube-prometheus-stack --namespace monitoring --version 52.1.0 -f 5-kong-values-monitoring.yaml

```

Kong Gateway does not expose Prometheus metrics by default. To enable them, create a Prometheus plugin instance:

```sh
kubectl apply -f 5-prometheus-plugin.yml
```

In this example, the services/routes provided by Kong are used instead of the custom web app to simulate more traffic:

```sh
kubectl apply -f https://developer.konghq.com/manifests/kic/multiple-services.yaml -n kong
kubectl apply -f 5-kong-routes.yml
```

Generate some traffic:

```sh
kubectl port-forward -n kong service/kong-gateway-proxy 8000:80
```

```sh
while true;
do
  curl http://localhost:8000/billing/status/200
  curl http://localhost:8000/billing/status/501
  curl http://localhost:8000/invoice/status/201
  curl http://localhost:8000/invoice/status/404
  curl http://localhost:8000/comments/status/200
  curl http://localhost:8000/comments/status/200
  sleep 0.01
done
```

Get access to Grafana locally:

```sh
echo "Password for Grafana will be:"
kubectl get secret --namespace monitoring promstack-grafana -o jsonpath="{.data.admin-password}" | base64 --decode ; echo
kubectl -n monitoring port-forward services/promstack-grafana 3000:80
#kubectl -n monitoring port-forward services/prometheus-operated 9090

```

Navigate to http://localhost:3000 and use the username `admin` and the password from above (should be `prom-operator`).

## Logs

Access logs are enabled by default.

## Traces

Traces are disabled by default and need to be enabled via environment variables configured in the Helm chart values.
See `kong/production/values.yml`.

Deploy Grafana Tempo as storage for traces:

```sh
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install Tempo 
helm install tempo grafana/tempo --namespace monitoring --create-namespace --version=1.24.1
```

Install the Kong OTEL plugin and configure it to send traces to Tempo:

```sh
kubectl apply -f 5-kong-otel-plugin.yml
```

Once a few requests have been made, traces are available to be queried from Tempo (it takes a while for new traces to become available):

```sh
kubectl port-forward service/tempo -n monitoring 3200:3200

```

```sh
curl -g -s "http://localhost:3200/api/search?tags=service.name=kong&limit=1" | jq '.traces'
```

Insert any TraceID obtained from the previous command:

```sh
curl -s "http://localhost:3200/api/traces/<TRACEID>" | jq
```
