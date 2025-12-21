---
shell: bash
---

# Traefik: Authorization via OIDC (OpenID-Connect)

NOTE: OIDC is a enterprise feature of Traefik. In this demo the third party plugin [sevensolutions/traefik-oidc-auth](https://github.com/sevensolutions/traefik-oidc-auth) was used.

For a more production like setup a Azure Kubernetes Cluster was created and Azure EntraID is used as OIDC Provider.
Prerequisites:

- AKS Cluster with default configuration, Traefik Gateway installed and setup as described in 1-traefik-setup.md and 2-traefik-https.md
- OIDC setup in [Azure](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc)

During setup note CLIENT_SECRET and provide it below or in a `.env` file in the root directory.

```sh
export $(cat ../.env | xargs)
# Or provide directly:
# export CLIENT_SECRET=fill_me
```

Web App Demo Application should be set up and reachable via https on our Azure Cluster:

```sh
export GATEWAY_HOST=$(kubectl get gateway gateway -o jsonpath='{.status.addresses[0].value}')
curl -k -H "Host: www.example.com" https://$GATEWAY_HOST
```

## Setup OIDC according to Third Party Plugin Docs:

- https://plugins.traefik.io/plugins/66b63d12d29fd1c421b503f5/oidc-authentication (click on "Install Plugin")
- https://traefik-oidc-auth.sevensolutions.cc/docs/getting-started

Store the CLIENT_SECRET from OIDC Provider as a Kubernetes secret, additionally generate a Secret that will be used to encrypt the Session Cookie:

```sh
kubectl create secret generic traefik-oidc-encryption-secret --from-literal=cookie-secret=$(openssl rand -base64 24)
kubectl create secret generic my-app-client-secret --from-literal=client-secret=${CLIENT_SECRET}
```

Configure the OIDC Middleware and apply it to the Cluster

```sh
kubectl apply -f 3-oidc-middleware.yml
```

Update static Traefik configuration to install the OIDC Plugin and apply it to all endpoints behind the https, "websecure" endpoint.
This configuration is defined in `3-traefik-oidc-values.yml`

```sh
helm upgrade traefik traefik/traefik \
  --version "37.4.0" \
  --namespace traefik \
  --values 3-traefik-oidc-values.yml
```

The Cluster does not have a Domain. Get the Public IP of the Cluster and change your /etc/hosts file so that www.example.com points to this ip

```sh
export GATEWAY_HOST=$(kubectl get gateway gateway -o jsonpath='{.status.addresses[0].value}')

echo "Add the following to /etc/hosts:"
echo "$GATEWAY_HOST www.example.com"

```

## Test Changes

If you now visit www.example.com (www is important!) you will be redirected to Azure to sign in with your account. After logging in you will be redirected to the Demo Web App.
