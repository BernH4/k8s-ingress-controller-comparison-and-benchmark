# Envoy: Authorization via OIDC (OpenID-Connect)

For a more production like setup a Azure Kubernetes Cluster was created and Azure EntraID is used as OIDC Provider.
Prerequisites:
- AKS Cluster with default configuration, Envoy Gateway installed and setup as described in 1-envoy-gw-setup.md and 2-envoy-gw-https.md
- OIDC setup in [Azure](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc)

During setup note CLIENT_SECRET and provide it below or in a `.env` file in the root directory.

```sh
export $(cat ../.env | xargs)
# export CLIENT_SECRET=fill_me
```

Web App Demo Application should be set up and reachable via https on our Azure Cluster:

```sh
export GATEWAY_HOST=$(kubectl get gateway gateway -o jsonpath='{.status.addresses[0].value}')
curl -k -H "Host: web-app.localhost" https://$GATEWAY_HOST
```

## Setup OIDC according to Envoy Gateway Docs

https://gateway.envoyproxy.io/docs/tasks/security/oidc/#oidc-authentication-for-a-httproute

```sh
kubectl create secret generic my-app-client-secret --from-literal=client-secret=${CLIENT_SECRET}
```

Apply the routes provided in the documentation, the backendRef has been changed to use our web app.

```sh
cat <<EOF | kubectl apply -f -
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: myapp
spec:
  parentRefs:
  - name: gateway #Changed to our gateway
  hostnames: ["www.example.com"]
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /myapp
    filters:
    - type: URLRewrite
      urlRewrite:
        path:
          type: ReplacePrefixMatch
          replacePrefixMatch: /   # <--- This replaces '/myapp' with '/'
    backendRefs: # changed to our web app
    - name: web-app-1
      port: 80
EOF
```

kubernetes apply -f 3-securitypolicy.yml

```sh
kubectl apply -f 3-securitypolicy.yml
```