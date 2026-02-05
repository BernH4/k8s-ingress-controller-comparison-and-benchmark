---
shell: bash
---

# Envoy Gateway

## 1. Prerequisites:

- Cluster setup according to `1-cluster-configuration.md`
- HTTPS setup according to `/envoy-gw/2-envoy-gw-https.md`

### Install EnvoyGateway

Deploy Envoy Gateway with some minor changes compared to DeveloperExperience Tests:

- No HighAvailability (Only one instance will be running)
- AccessLogs enabled
- Metrics disabled
- Traces disabled

The proxy (data plane) will be running without cpu/memory limits and is only bound by the nodes resources.

Install the Gateway API CRDs and Envoy Gateway:

```sh
helm install eg oci://docker.io/envoyproxy/gateway-helm --version v1.6.1 -n envoy-gateway-system --create-namespace
```

Wait for Envoy Gateway to become available:

```sh {"terminalRows":"2"}
kubectl wait --timeout=5m -n envoy-gateway-system deployment/envoy-gateway --for=condition=Available
```

Deploy the Envoy specific GatewayClass and Gateway

```sh
kubectl apply -f combined-envoy-conf.yml
```

One data plane and one control plane should be running:

```sh
kubectl get pods -n envoy-gateway-system
```

Configure a HTTPRoute to each web app configured in `1-cluster-configuration.md`

```sh {"promptEnv":"never"}
export BACKEND_APPLICATIONS=10
(
cat <<HEAD
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: performance-test-routes
  namespace: default
spec:
  parentRefs:
    - name: gateway
      sectionName: web
    - name: gateway
      sectionName: websecure
  hostnames:
    - "web-app.localhost"
    - "www.example.com"
  rules:
HEAD

for i in $(seq 1 $BACKEND_APPLICATIONS)
do
cat <<RULE
  - matches:
    - path:
        type: PathPrefix
        value: /web-app-$i
    backendRefs:
    - name: web-app-$i
      port: 80
    filters:
    - type: URLRewrite
      urlRewrite:
        path:
          type: ReplacePrefixMatch
          replacePrefixMatch: /
RULE
done
) | kubectl apply -f -
```

Gateway and Routes should be working:

```sh {"terminalRows":"20"}
kubectl get -n default gatewayclass,gateway,httproute
```

### Test Application

Web App Demo Application should be set up and reachable on our Azure Cluster:

If the response is empty, wait for a few minutes until the setup is completely initialized.

```sh
export GATEWAY_HOST=$(kubectl get gateway/gateway -o jsonpath='{.status.addresses[0].value}')
curl -H "Host: www.example.com" http://$GATEWAY_HOST/web-app-1
```

Also HTTPS connection should work:

```sh
kubectl get secret root-secret -n cert-manager -o jsonpath='{.data.tls\.crt}' | base64 -d > ca.crt
curl --cacert ca.crt -H "Host: www.example.com" https://$GATEWAY_HOST/web-app-1
```

## Performance Test

To track CPU usage of the Nodes/Pods the following commands can be used:

```sh
watch k top nodes

```

```sh
watch kubectl top pods -A --sort-by=cpu
```

Now execute the k6 load test scripts on the Virtual Machine.

## Reliability Tests

### Hot Reloading

The following script will update a route to point to a random service every 5 seconds.
Theoretically a route change should not result in any downtime/5xx responses.

When running the load tests in parallel the test output should have a zero value at http_req_failed.

First, simplify routing to have just one rule, /web-app-1 will point to web-app-1

```sh
cat <<EOF | kubectl apply -f -
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: performance-test-routes
  namespace: default
spec:
  parentRefs:
    - name: gateway
      sectionName: web
    - name: gateway
      sectionName: websecure
  hostnames:
    - "web-app.localhost"
    - "www.example.com"
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /web-app-1
    backendRefs:
    - name: web-app-1
      port: 80
    filters:
    - type: URLRewrite
      urlRewrite:
        path:
          type: ReplacePrefixMatch
          replacePrefixMatch: /
EOF
```

This script will now update the single rule to point to a random web-app:

```sh
ROUTE_NAME="performance-test-routes"
NAMESPACE="default"
BACKEND_APPLICATIONS=10
SLEEP_SECONDS=5

while true; do
  # 2. Pick a random backend service to point to (web-app-1 to web-app-10)
  RANDOM_BACKEND="web-app-$((1 + RANDOM % BACKEND_APPLICATIONS))"

  echo "Redirecting to $RANDOM_BACKEND..."

  # 3. Apply the patch
  kubectl patch httproute $ROUTE_NAME \
    -n $NAMESPACE \
    --type='json' \
    -p="[{\"op\": \"replace\", \"path\": \"/spec/rules/0/backendRefs/0/name\", \"value\": \"$RANDOM_BACKEND\"}]"

  sleep $SLEEP_SECONDS
done
```

While the script is running, execute the loadtest on the VM with the following parameters, it will send 20k RPS and will just hit the single endpoint configured.

`./run_test.sh 20000 1`

### Rolling Updates

Updating the version of the Gateway should not lead to any downtime/5xx responses.

Envoy Gateway was installed using version 1.6.1, which installed EnvoyProxy v1.36.2.
Test Rolling Updates by downgrading to Helmchart version to 1.5.0, which will downgrade EnvoyProxy to v1.35.0:

```sh
helm upgrade eg oci://docker.io/envoyproxy/gateway-helm --version v1.5.0 -n envoy-gateway-system
```
