---
shell: bash
---

# Cluster Configuration

## 1. Prerequisites:

- Kubernetes Cluster with one worker node running and a seperate VirtualMachine with k6 installed to run load Tests

In this tests the following specs were deployed:

- Azure AKS Cluster with Worker Node of type:
   .... TODO
- Azure VM with specs:
   .....TODO

## TMP TODO LOCAL SETUP

```sh
kind create cluster --config ../kind-config-1-worker-node.yml --name cluster-envoy-gw
```

### Run Gateway and Workload on two different Nodes

```sh {"interactive":"false","promptEnv":"never"}
export GATEWAY_NODE_NAME=aks-gatewaynode-24934390-vmss000002
export WORKLOAD_NODE_NAME=aks-workloadnode-13792356-vmss000002
echo "DEBUG: Applying config to Node: $WORKLOAD_NODE_NAME"
#kubectl label nodes $GATEWAY_NODE_NAME role=gateway
kubectl label nodes $WORKLOAD_NODE_NAME role=workload
# Configure Workload Node to not allow any pods to schedule on it
# Workload Pods will be configured to ignore this taint to be the only pods scheduled on this node
kubectl taint nodes $WORKLOAD_NODE_NAME dedicated=workload:NoSchedule
```

Deploy simple web-app with 10 replicas to ensure the web app won't be the bottleneck:

```sh {"promptEnv":"never"}
export REPLICAS=10
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-config
  namespace: default
data:
  index.html: |
    <html>
    <h2>Hello from Web App!</h2>
    </html>
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: default
spec:
  replicas: $REPLICAS
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      tolerations:
        - key: "dedicated"
          operator: "Equal"
          value: "workload"
          effect: "NoSchedule"
      nodeSelector:
        role: "workload"
      containers:
      - name: nginx
        image: nginx
        ports:
        - containerPort: 80
        volumeMounts:
        - name: nginx-index-config
          mountPath: /usr/share/nginx/html
      volumes:
      - name: nginx-index-config
        configMap:
          name: nginx-config
EOF
```

Faking having multiple backends by creating many services but all point to the same backend:

```sh {"promptEnv":"never"}
export BACKEND_APPLICATIONS=10
for i in $(seq 1 $BACKEND_APPLICATIONS); do
cat <<EOF
---
apiVersion: v1
kind: Service
metadata:
  name: web-app-$i
  namespace: default
spec:
  selector:
    app: web-app
  type: ClusterIP
  ports:
  - name: http
    port: 80
    targetPort: 80
EOF
done | kubectl apply -f -
```

All deployed ressources should now be working fine.

```sh {"terminalRows":"20"}
kubectl get -n default deploy,svc,pods
```

The routes to the applications will be configured seperatly in each gateway section.
