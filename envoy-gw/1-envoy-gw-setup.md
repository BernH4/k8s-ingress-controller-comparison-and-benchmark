---
shell: bash
---

# Envoy

## 1. Create Kubernetes Cluster

```sh
kind create cluster --config ../kind-config-3-worker-nodes.yml --name cluster-envoy-gw
```

## Quickstart

Quickstart reference: https://doc.traefik.io/traefik/getting-started/kubernetes/

### Install EnvoyGateway

Install the Gateway API CRDs and Envoy Gateway:

```sh
helm install eg oci://docker.io/envoyproxy/gateway-helm --version v1.6.1 -n envoy-gateway-system --create-namespace
```

Wait for Envoy Gateway to become available:

```sh {"terminalRows":"2"}
kubectl wait --timeout=5m -n envoy-gateway-system deployment/envoy-gateway --for=condition=Available
```

### Deploy Sample Application

Install the GatewayClass, Gateway, HTTPRoute and example app provided by Envoy Quickstart Guide:

```markdown
kubectl apply -f https://github.com/envoyproxy/gateway/releases/download/v1.6.1/quickstart.yaml -n default
```

### Test Application

Get the name of the Envoy service created the by the example Gateway and forward the port:

```markdown
export ENVOY_SERVICE=$(kubectl get svc -n envoy-gateway-system --selector=gateway.envoyproxy.io/owning-gateway-namespace=default,gateway.envoyproxy.io/owning-gateway-name=eg -o jsonpath='{.items[0].metadata.name}')

kubectl -n envoy-gateway-system port-forward service/${ENVOY_SERVICE} 8888:80
```

Curl the example app through Envoy proxy:

```markdown {"terminalRows":"20"}
curl --header "Host: www.example.com" http://localhost:8888/get
```

## Production deployment

The initial deployment is the same as in the quickstart, just the provided Sample Application will be removed.

```markdown
kubectl delete -f https://github.com/envoyproxy/gateway/releases/download/v1.6.1/quickstart.yaml --ignore-not-found=true
```

### Deployment

Deploy the Envoy specific GatewayClass and Gateway

```sh
kubectl apply -f gatewayclass.yml
kubectl apply -f gateway.yml
kubectl apply -f envoyproxy.yml
```

As Envoy GW was configured to be HA (High Available), two data planes and one control plane should be running:

```sh
kubectl get pods -n envoy-gateway-system
```

Deploy a custom web-app, httproute, and gateway that will be reused by all gateways.

```sh
kubectl apply -f ../common_config_files/web-app-1.yml
kubectl apply -f ../common_config_files/httproute.yml
```

All deployed ressources should now be working fine (altough the gateway will return Programmed: False as there is no cloud provider assigning it an address):

```sh {"terminalRows":"20"}
kubectl get -n default gatewayclass,gateway,httproute,deploy,svc,pods
```

### Test Application

Verify the application is accessible (make sure to cancel earlier port-forward):

```sh
export ENVOY_SERVICE=$(kubectl get svc -n envoy-gateway-system --selector=gateway.envoyproxy.io/owning-gateway-namespace=default,gateway.envoyproxy.io/owning-gateway-name=gateway -o jsonpath='{.items[0].metadata.name}')

kubectl -n envoy-gateway-system port-forward service/${ENVOY_SERVICE} 8000:80

```

```sh
curl http://web-app.localhost:8000
```

**Application URL:** http://web-app.localhost:8000

### Delete Cluster

```sh
kind delete cluster -n cluster-envoy-gw
```
