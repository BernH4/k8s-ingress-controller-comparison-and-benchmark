---
shell: bash
---

# Cluster Configuration

## 1. Prerequisites

- Kubernetes cluster with one worker node running and a separate virtual machine with k6 installed to run load tests.

In these tests the following specifications were used:

### **Performance Tests: VM Specifications**

| Node Role | Azure VM Size | vCPUs | Memory (GB) |
| :--- | :--- | :--- | :--- |
| Gateway Node | Standard_D8as_v6 | 8 | 32 |
| Workload Node | Standard_E8pds_v6 | 8 | 64 |
| Load Generator VM | Standard_D8als_v6 | 8 | 16 |

### Run Gateway and Workload on two different Nodes

```sh {"interactive":"false","promptEnv":"never"}
export WORKLOAD_NODE_NAME=aks-workloadnode-13792356-vmss000002
kubectl label nodes $WORKLOAD_NODE_NAME role=workload
# Configure Workload Node to not allow any pods to schedule on it
# Workload Pods will be configured to ignore this taint to be the only pods scheduled on this node
kubectl taint nodes $WORKLOAD_NODE_NAME dedicated=workload:NoSchedule
```

Deploy a simple web app with 10 replicas to ensure the web app will not be the bottleneck:

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

Simulate having multiple backends by creating many services that all point to the same backend:

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

All deployed resources should now be working:

```sh {"terminalRows":"20"}
kubectl get -n default deploy,svc,pods
```

The routes to the applications will be configured separately in each gateway section.

# Load Test VM
After provisioning the VM for load tests, [install K6](https://grafana.com/docs/k6/latest/set-up/install-k6/) and copy over the following files, required to run the load tests:
- `run_test.sh`
- `constant_rps.js`
