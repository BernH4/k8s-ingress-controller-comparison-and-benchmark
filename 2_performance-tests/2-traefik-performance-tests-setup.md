---
shell: bash
---

# Traefik

## 1. Prerequisites

- Cluster setup according to `1-cluster-configuration.md`
- HTTPS setup according to `/1_developer-experience-tests/traefik/2-traefik-https.md`

### Install Traefik

Deploy Traefik with some minor changes compared to the developer experience tests:

- No high availability (only one instance will be running)
- Access logs enabled
- Metrics disabled
- Traces disabled

The proxy (data plane) will be running without CPU/memory limits and is only bound by the node's resources.

### Install Traefik

Add the Traefik Helm repository (make sure the cluster has been created first):

```sh
helm repo add traefik https://traefik.github.io/charts
helm repo update
```

Install Traefik:

```sh
helm install traefik traefik/traefik \
  --version "37.4.0" \
  --namespace traefik \
  --create-namespace \
  --values traefik-helm-enable-access-logs.yml
```

One Traefik instance should be running:

```sh
kubectl get pods -n traefik
```

### Deployment

Deploy the Traefik-specific GatewayClass and Gateway:

```sh
kubectl apply -f combined-traefik-conf.yml
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

### Test Application

The web app demo application should be set up and reachable on the Azure cluster.

If the response is empty, wait a few minutes until the setup is completely initialized.

```sh
export GATEWAY_HOST=$(kubectl get gateway/gateway -o jsonpath='{.status.addresses[0].value}')
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

While the script is running, execute the load test on the VM with the following parameters. It will send 10k RPS and will hit only the single endpoint configured.

`./run_test.sh 10000 1`

### Rolling Updates

Updating the version of the gateway should not lead to any downtime or 5xx responses.

Traefik was installed using Helm chart version 37.4.0, which installed Traefik v3.6.2.
Test rolling updates by downgrading to Helm chart version 37.2.0, which will downgrade Traefik to v3.5.3:

```sh
helm upgrade traefik traefik/traefik --version "37.2.0" -n traefik 
```
