---
shell: bash
---

# Kong: Exportable Observability (Logging, Metrics, Tracing)

Following the kong documentation example, this will deploy a servicemonitor Kubernetes resource using the Kong Gateway Helm chart, then use a KongClusterPlugin to configure the prometheus plugin for all Services in the cluster.

**Prerequisites:**

- Kong installed and setup as described in `1-kong-setup.md`.

Documentation:

- https://developer.konghq.com/kubernetes-ingress-controller/observability/prometheus/
- https://developer.konghq.com/kubernetes-ingress-controller/observability/prometheus-grafana/
- https://developer.konghq.com/how-to/collect-metrics-logs-and-traces-with-opentelemetry/
- https://developer.konghq.com/plugins/opentelemetry/examples/traces/
- https://developer.konghq.com/plugins/prometheus/reference/

## Metrics

Install PRometheus and Grafana using a provided configuration file `5-kong-values-monitoring.yaml`.

```sh
kubectl create namespace monitoring
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install promstack prometheus-community/kube-prometheus-stack --namespace monitoring --version 52.1.0 -f 5-kong-values-monitoring.yaml

```

Kong Gateway doesn’t expose Prometheus metrics by default. To enable the metrics, create a prometheus plugin instance:

```sh
kubectl apply -f 5-prometheus-plugin.yml
```

In this example we use the services/routes provided by kong instead of our own web app to simulate more traffic.

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

Navigate to http://localhost:3000 and use the username admin and the password that you from above, should be `prom-operator`.

## Logs

Access Logs are enabled by default.

## Traces

Traces are disabled by default and need to be enabled via environment variables configured helm chart values.yml.
See `kong/production/values.yml`

Deploy Grafana Tempo as Storage for Traces.

```sh
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install Tempo 
helm install tempo grafana/tempo --namespace monitoring --create-namespace --version=1.24.1
```

Install Kong OTEL Plugin and configure it to send traces to Tempo:

```sh
kubectl apply -f 5-kong-otel-plugin.yml
```

If a few requests have been done, traces are available to be queried from tempo (it takes a while for new traces to be available in tempo):

```sh
kubectl port-forward service/tempo -n monitoring 3200:3200

```

```sh
curl -g -s "http://localhost:3200/api/search?tags=service.name=kong&limit=1" | jq '.traces'
```

Insert any TraceID gotten from previous command:

```sh
curl -s "http://localhost:3200/api/traces/<TRACEID>" | jq
```
