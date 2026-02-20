# Kong: Authorization via OIDC (OpenID Connect)

For a more production like setup, an Azure Kubernetes cluster was created and Azure EntraID is used as OIDC provider.

**Prerequisites:**

- AKS cluster with default configuration, Kong installed and set up as described in `1-kong-setup.md` and `2-kong-https.md`
- OIDC setup in [Azure](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc)

During setup, note the CLIENT_SECRET and provide it below or in a `.env` file in the root directory.

```sh
export $(cat ../../.env | xargs)
# Or provide directly:
# export CLIENT_SECRET=fill_me
```

The web app demo application should be set up and reachable via HTTPS on the Azure cluster:

```sh
export GATEWAY_HOST=$(kubectl get gateway gateway -o jsonpath='{.status.addresses[0].value}')
curl -k -H "Host: www.example.com" https://$GATEWAY_HOST
```

## Setup OIDC according to Kong Docs

https://developer.konghq.com/kubernetes-ingress-controller/oidc/

OIDC is an enterprise plugin, an account has to be created to start a 30-day trial.
Request a [PAT](https://cloud.konghq.com/global/account/tokens) and put it in your `.env` file.

```sh
export $(cat ../../.env | xargs)
# Or provide directly:
# export KONNECT_TOKEN=fill_me
```

Use the Konnect API to create a new CLUSTER_TYPE_K8S_INGRESS_CONTROLLER control plane:

```sh
export CONTROL_PLANE_DETAILS=$(curl -X POST "https://us.api.konghq.com/v2/control-planes" \
     --no-progress-meter --fail-with-body \
     -H "Authorization: Bearer $KONNECT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "My KIC CP",
       "cluster_type": "CLUSTER_TYPE_K8S_INGRESS_CONTROLLER"
     }')
export CONTROL_PLANE_ID=$(echo $CONTROL_PLANE_DETAILS | jq -r .id)
export CONTROL_PLANE_TELEMETRY=$(echo $CONTROL_PLANE_DETAILS | jq -r '.config.telemetry_endpoint | sub("https://";"")')
echo $CONTROL_PLANE_ID

```

Create and use mTLS certificates, they will be used for KIC-to-Konnect communication:

```sh
openssl req -new -x509 -nodes -newkey rsa:2048 -subj "/CN=kongdp/C=US" -keyout ./tls.key -out ./tls.crt
export CERT=$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' tls.crt);
curl -X POST "https://us.api.konghq.com/v2/control-planes/$CONTROL_PLANE_ID/dp-client-certificates" \
     --no-progress-meter --fail-with-body \
     -H "Authorization: Bearer $KONNECT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "cert": "'"$CERT"'"
     }'
kubectl create secret tls konnect-client-tls -n kong --cert=./tls.crt --key=./tls.key

```

As a managed control plane (Konnect) is now used, the installation has to be adapted to switch from self-hosted to managed:

Note: This will overwrite the high-availability configuration from `1-kong-setup.md`, but for OIDC demonstration purposes this is acceptable.

```sh
cat <<EOF > 3-helm-values-managed-cp.yaml
controller:
  ingressController:
    image:
      tag: "3.5"
    env:
      feature_gates: "FillIDs=true"
    konnect:
      license:
        enabled: true
      enabled: true
      controlPlaneID: "$CONTROL_PLANE_ID"
      tlsClientCertSecretName: konnect-client-tls
      apiHostname: "us.kic.api.konghq.com"
gateway:
  image:
    repository: kong/kong-gateway
    tag: "3.12"
  env:
    konnect_mode: 'on'
    vitals: "off"
    cluster_mtls: pki
    cluster_telemetry_endpoint: "$CONTROL_PLANE_TELEMETRY:443"
    cluster_telemetry_server_name: "$CONTROL_PLANE_TELEMETRY"
    cluster_cert: /etc/secrets/konnect-client-tls/tls.crt
    cluster_cert_key: /etc/secrets/konnect-client-tls/tls.key
    lua_ssl_trusted_certificate: system
    proxy_access_log: "off"
    dns_stale_ttl: "3600"
  secretVolumes:
     - konnect-client-tls
EOF

helm upgrade kong kong/ingress --version "0.21.0" -n kong --values ./3-helm-values-managed-cp.yaml

```

Apply the KongPlugin `openid-connect`, which attaches OIDC authentication to all routes the gateway manages.
It is configured to use Azure as the OIDC provider.

```sh
echo "
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: openid-connect
  namespace: default
  annotations:
    kubernetes.io/ingress.class: kong
config:
  issuer: "https://login.microsoftonline.com/8a12626e-40bc-44f1-8955-e4782cebfbc1/v2.0"
  client_id:
  - '047094fd-3b17-4085-84fb-504deb4153de'
  client_secret:
  - '$CLIENT_SECRET'
  redirect_uri:
    - https://www.example.com/oauth2/callback
  scopes:
    - 047094fd-3b17-4085-84fb-504deb4153de/.default
  logout_uri_suffix: '/logout'
  logout_methods:
  - GET
  logout_revoke: true
plugin: openid-connect
" | kubectl apply -f -
```


The cluster does not have a domain. Get the public IP of the cluster and update your `/etc/hosts` file so that `www.example.com` points to this IP:

```sh
export GATEWAY_HOST=$(kubectl get gateway gateway -o jsonpath='{.status.addresses[0].value}')

echo "Add the following to /etc/hosts:"
echo "$GATEWAY_HOST www.example.com"

```

## Test Changes

If you now visit `www.example.com` (the `www` prefix is important), you will be redirected to Azure to sign in with your account. After logging in, you will be redirected to the demo web app.
