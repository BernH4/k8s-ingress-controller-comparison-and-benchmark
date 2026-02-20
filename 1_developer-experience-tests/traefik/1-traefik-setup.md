---
shell: bash
---

# Traefik

## 1. Create Kubernetes Cluster

```sh
kind create cluster --config ../../kind-config-3-worker-nodes.yml --name cluster-traefik
```

## Quickstart

Quickstart reference: https://doc.traefik.io/traefik/getting-started/kubernetes/

### Install Traefik

Add the Traefik Helm repository:

```sh
helm repo add traefik https://traefik.github.io/charts
helm repo update
```

Install Traefik using the provided quickstart values:

```sh
helm install traefik traefik/traefik -f quickstart/values-quickstart.yml --wait
```

### Access Dashboard

Port-forward the Traefik service (using port 8000 to avoid root permissions):

```sh
kubectl port-forward svc/traefik 8000:80
```

**Dashboard URL:** http://dashboard.localhost:8000/dashboard/

### Deploy Sample Application

Deploy the provided whoami application and expose it via the Gateway API:

```sh
kubectl apply -f quickstart/whoami-service.yaml
kubectl apply -f quickstart/whoami.yaml
kubectl apply -f quickstart/httproute.yaml
```

### Test Application

Verify the application is accessible:

```sh
curl http://whoami-gatewayapi.localhost:8000
```

**Application URL:** http://whoami-gatewayapi.localhost:8000

### Recreate Cluster

Recreate the cluster to continue testing a more production like deployment:

```sh
kind delete cluster -n cluster-traefik
kind create cluster --config ../../kind-config-3-worker-nodes.yml --name cluster-traefik
```

## Production Deployment

Documentation used:

- https://doc.traefik.io/traefik/setup/kubernetes/
- https://doc.traefik.io/traefik/reference/install-configuration/providers/kubernetes/kubernetes-gateway/
- https://doc.traefik.io/traefik/reference/routing-configuration/kubernetes/gateway-api/

### Install Traefik

Add the Traefik Helm repository (make sure the cluster has been created first):

```sh
helm repo add traefik https://traefik.github.io/charts
helm repo update
```

Install Traefik using custom production values:

```sh
helm install traefik traefik/traefik \
  --version "37.4.0" \
  --namespace traefik \
  --create-namespace \
  --values production/values-production.yml
```

As Traefik was configured to be HA (highly available), two Traefik pods should now be running:

```sh
kubectl get pods -n traefik
```

### Access Dashboard

Port forward one Traefik pod.
Here, forwarding a pod directly via a deployment is needed, as the dashboard is no longer exposed publicly:

```sh
kubectl port-forward -n traefik deployment/traefik 8080:8080
```

**Dashboard URL:** http://dashboard.localhost:8080/dashboard/

### Deployment

Deploy the Traefik specific GatewayClass and Gateway:

```sh
kubectl apply -f production/gateway.yml
kubectl apply -f production/gatewayclass.yml
```

Deploy a custom web app and HTTPRoute that will be reused by all gateways:

```sh
kubectl apply -f ../../common_config_files/web-app-1.yml
kubectl apply -f ../../common_config_files/httproute.yml
```

All deployed resources should now be working:

```sh {"terminalRows":"19"}
kubectl get -n default gatewayclass,gateway,httproute,deploy,svc,pods
```

### Test Application

Verify the application is accessible:

```sh
kubectl port-forward -n traefik service/traefik 8000:80
```

```sh
curl http://web-app.localhost:8000
```

**Application URL:** http://web-app.localhost:8000

### Delete Cluster

Skip this if you want to continue with `2-traefik-https.md` or other tests.

```sh
kind delete cluster -n cluster-traefik
```
