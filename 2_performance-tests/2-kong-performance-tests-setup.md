---
shell: bash
---

# Kong

## 1. Prerequisites

- Cluster setup according to `1-cluster-configuration.md`
- HTTPS setup according to `/1_developer-experience-tests/kong/2-kong-https.md`

### Install Kong

Deploy Kong with some minor changes compared to the developer experience tests:

- No high availability (only one instance will be running)
- Access logs enabled
- Metrics disabled
- Traces disabled

The proxy (data plane) will be running without CPU/memory limits and is only bound by the node's resources.

### Install Kong Ingress Controller

Enable the Gateway API:

```sh
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.3.0/standard-install.yaml
```

Create a Gateway and GatewayClass instance to use:

```sh
kubectl create namespace kong
kubectl apply -n kong -f combined-kong-conf.yml
```

Add the Kong Helm repository:

```sh
helm repo add kong https://charts.konghq.com
helm repo update
```

Install Kong:

```sh
helm install kong kong/ingress --version "0.21.0" -n kong -f kong-helm-performance-tweaks.yml
```

Control and data plane should now be running:

```sh
kubectl get pods -n kong -o wide
```

Configure an HTTPRoute to each web app configured in `1-cluster-configuration.md`:

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
      namespace: kong
      sectionName: web
    - name: gateway
      namespace: kong
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

### Test Application

The web app demo application should be set up and reachable on the Azure cluster.

If the response is empty, wait a few minutes until the setup is completely initialized.

```sh
export GATEWAY_HOST=$(kubectl get -n kong gateway/gateway -o jsonpath='{.status.addresses[0].value}')
echo $GATEWAY_HOST
curl -H "Host: www.example.com" http://$GATEWAY_HOST/web-app-1
```

The HTTPS connection should also work:

```sh
kubectl get secret root-secret -n cert-manager -o jsonpath='{.data.tls\.crt}' | base64 -d > ca.crt
curl --cacert ca.crt -H "Host: www.example.com" https://$GATEWAY_HOST/web-app-1
```

## Performance Test

To track CPU usage of the nodes/pods, the following commands can be used:

```sh
watch k top nodes

```

```sh
watch kubectl top pods -A --sort-by=memory
```

Now execute the k6 load test scripts on the virtual machine.

## Reliability Tests

### Hot Reloading

The following script will update a route to point to a random service every 5 seconds.
Theoretically, a route change should not result in any downtime or 5xx responses.

When running the load tests in parallel, the test output should have a zero value at http_req_failed.

First, simplify routing to have just one rule; `/web-app-1` will point to `web-app-1`:

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
      namespace: kong
      sectionName: web
    - name: gateway
      namespace: kong
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

This script will now update the single rule to point to a random web app:

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

While the script is running, execute the load test on the VM with the following parameters. It will send 20k RPS and will hit only the single endpoint configured.

`./run_test.sh 20000 1`

### Rolling Updates

Updating the version of the gateway should not lead to any downtime or 5xx responses.

Kong Ingress Controller was installed using Helm chart version 0.21.0, which installed Kong v3.9.
Test rolling updates by downgrading to Helm chart version 0.17.0, which will downgrade Kong to v3.8:

```sh
helm upgrade kong kong/ingress --version "0.17.0" -n kong 
```
