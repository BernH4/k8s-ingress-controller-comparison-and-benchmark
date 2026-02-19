---
shell: bash
---

# Kong

## 1. Create Kubernetes Cluster

```sh
kind create cluster --config ../../kind-config-3-worker-nodes.yml --name cluster-kong
```

## Quickstart

Quickstart reference: https://developer.konghq.com/kubernetes-ingress-controller/install/

### Install Kong Ingress Controller

Enable the Gateway API:

```sh
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.3.0/standard-install.yaml
```

Create a Gateway and GatewayClass instance to use:

```sh
kubectl create namespace kong
kubectl apply -n kong -f quickstart/gateway.yml
kubectl apply -n kong -f quickstart/gatewayclass.yml
```

Add the Kong Helm repository:

```sh
helm repo add kong https://charts.konghq.com
helm repo update
```

Install Kong using the provided quickstart values:

```sh
helm install kong kong/ingress --version "0.21.0" -n kong --create-namespace
```

### Deploy Sample Application

Deploy the provided echo application and expose it via Gateway API:

```sh
kubectl apply -f https://developer.konghq.com/manifests/kic/echo-service.yaml -n kong
kubectl apply -f quickstart/httproute.yml
```

### Test Application

Port forward the Kong service (using port 8000 to avoid root permissions):

```sh
kubectl port-forward -n kong service/kong-gateway-proxy 8000:80
```

Verify the application is accessible:

```sh
curl http://localhost:8000/echo

```

**Application URL:** http://localhost:8000/echo

## Production deployment

Documentation used:

- https://developer.konghq.com/kubernetes-ingress-controller/
- https://developer.konghq.com/kubernetes-ingress-controller/deployment-topologies/gateway-discovery/
- https://github.com/Kong/charts/tree/main/charts/ingress
- https://github.com/Kong/charts/blob/main/charts/ingress/values.yaml
- https://github.com/Kong/charts/blob/main/charts/kong/README.md

The initial deployment is expanded to use custom values.yml that configures high availability.

```sh
helm upgrade kong kong/ingress --version "0.21.0" -n kong -f production/values.yml
```

Now 2 control planes should be running on different nodes:

```sh
kubectl get pods -n kong -o wide
```

The provided Sample Application will be removed. The gateway is changed to be deployed in default namespace, similar to the comomn httproute.yml.

```sh
kubectl delete -f https://developer.konghq.com/manifests/kic/echo-service.yaml -n kong --ignore-not-found=true
kubectl delete -f quickstart/httproute.yml --ignore-not-found=true
kubectl delete -f quickstart/gateway.yml -n kong --ignore-not-found=true
```

### Deployment

Deploy a custom web-app and httproute that will be reused by all gateways.
Additionally use the production gateway config that reuses values similar to traefik and envoy gatway.

```sh
kubectl apply -f production/gateway.yml
kubectl apply -f ../../common_config_files/web-app-1.yml
kubectl apply -f ../../common_config_files/httproute.yml
```

### Test Application

Verify the application is accessible (make sure to cancel earlier port-forward):

```sh
kubectl port-forward -n kong service/kong-gateway-proxy 8000:80
```

```sh
curl http://web-app.localhost:8000
```

**Application URL:** http://web-app.localhost:8000

### Delete Cluster

```sh
kind delete cluster -n cluster-kong
```
