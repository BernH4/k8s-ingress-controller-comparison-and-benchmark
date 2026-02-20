---
shell: bash
---

# Envoy Gateway

## 1. Create Kubernetes Cluster

```sh
kind create cluster --config ../../kind-config-3-worker-nodes.yml --name cluster-envoy-gw
```

## Quickstart

Quickstart reference: https://gateway.envoyproxy.io/docs/tasks/quickstart/

### Install Envoy Gateway

Install the Gateway API CRDs and Envoy Gateway:

```sh
helm install eg oci://docker.io/envoyproxy/gateway-helm --version v1.6.1 -n envoy-gateway-system --create-namespace
```

Wait for Envoy Gateway to become available:

```sh {"terminalRows":"2"}
kubectl wait --timeout=5m -n envoy-gateway-system deployment/envoy-gateway --for=condition=Available
```

### Deploy Sample Application

Install the GatewayClass, Gateway, HTTPRoute and example app provided by the Envoy Quickstart Guide:

```markdown
kubectl apply -f https://github.com/envoyproxy/gateway/releases/download/v1.6.1/quickstart.yaml -n default
```

### Test Application

Get the name of the Envoy service created by the example Gateway and forward the port:

```markdown
export ENVOY_SERVICE=$(kubectl get svc -n envoy-gateway-system --selector=gateway.envoyproxy.io/owning-gateway-namespace=default,gateway.envoyproxy.io/owning-gateway-name=eg -o jsonpath='{.items[0].metadata.name}')

kubectl -n envoy-gateway-system port-forward service/${ENVOY_SERVICE} 8888:80
```

Curl the example app through Envoy proxy to check if the install is working:

```markdown {"terminalRows":"20"}
curl --header "Host: www.example.com" http://localhost:8888/get
```

## Production Deployment

The initial deployment is the same as in the quickstart, only the provided sample application will be removed.

```markdown
kubectl delete -f https://github.com/envoyproxy/gateway/releases/download/v1.6.1/quickstart.yaml --ignore-not-found=true
```

### Deployment

Deploy the Envoy-specific GatewayClass and Gateway and apply the Envoy data plane (proxy) configuration that includes more production-like settings:

```sh
kubectl apply -f gatewayclass.yml
kubectl apply -f gateway.yml
kubectl apply -f envoyproxy.yml
```

As Envoy Gateway was configured to be HA (highly available), two data planes and one control plane should be running:

```sh
kubectl get pods -n envoy-gateway-system
```

Deploy a custom web app and HTTPRoute that will be reused by all gateways:

```sh
kubectl apply -f ../../common_config_files/web-app-1.yml
kubectl apply -f ../../common_config_files/httproute.yml
```

All deployed resources should now be working (although the gateway will return Programmed: False as there is no cloud provider assigning it an address):

```sh {"terminalRows":"20"}
kubectl get -n default gatewayclass,gateway,httproute,deploy,svc,pods
```

### Test Application

Verify the application is accessible (make sure to cancel the earlier port-forward):

```sh
export ENVOY_SERVICE=$(kubectl get svc -n envoy-gateway-system --selector=gateway.envoyproxy.io/owning-gateway-namespace=default,gateway.envoyproxy.io/owning-gateway-name=gateway -o jsonpath='{.items[0].metadata.name}')

kubectl -n envoy-gateway-system port-forward service/${ENVOY_SERVICE} 8000:80

```

The web app should be reachable. If the response is empty, wait a few minutes until the setup is completely initialized.

```sh
curl http://web-app.localhost:8000
```

**Application URL:** http://web-app.localhost:8000

### Delete Cluster

Skip this if you want to continue with `2-envoy-gw-https.md` or other tests.

```sh
kind delete cluster -n cluster-envoy-gw
```
