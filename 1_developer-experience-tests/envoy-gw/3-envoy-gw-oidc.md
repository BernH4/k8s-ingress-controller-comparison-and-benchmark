# Envoy: Authorization via OIDC (OpenID-Connect)

For a more production like setup a Azure Kubernetes Cluster was created and Azure EntraID is used as OIDC Provider.

**Prerequisites:**

- AKS Cluster with default configuration, Envoy Gateway installed and setup as described in `1-envoy-gw-setup.md` and `2-envoy-gw-https.md`
- OIDC setup in [Azure](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc)

During setup note CLIENT_SECRET and provide it below or in a `.env` file in the root directory.

```sh
export $(cat ../../.env | xargs)
# Or provide directly:
# export CLIENT_SECRET=fill_me
```

Web App Demo Application should be set up and reachable via https on our Azure Cluster:

```sh
export GATEWAY_HOST=$(kubectl get gateway gateway -o jsonpath='{.status.addresses[0].value}')
curl -k -H "Host: www.example.com" https://$GATEWAY_HOST
```

## Setup OIDC according to Envoy Gateway Docs

https://gateway.envoyproxy.io/docs/tasks/security/oidc/#oidc-authentication-for-a-httproute

Store the CLIENT_SECRET from OIDC Provider as a Kubernetes secret:

```sh
kubectl create secret generic my-app-client-secret --from-literal=client-secret=${CLIENT_SECRET}
```

Apply SecurityPolicy which configures to attach OIDC Auth to all routes the gateway manages.
It is configured to use Azure as OIDC Provider.

```sh
kubectl apply -f 3-securitypolicy.yml
```

The Cluster does not have a Domain. Get the Public IP of the Cluster and change your /etc/hosts file so that www.example.com points to this ip

```sh
export GATEWAY_HOST=$(kubectl get gateway gateway -o jsonpath='{.status.addresses[0].value}')

echo "Add the following to /etc/hosts:"
echo "$GATEWAY_HOST www.example.com"

```

## Test Changes

If you now visit www.example.com (www is important!) you will be redirected to Azure to sign in with your account. After logging in you will be redirected to the Demo Web App.