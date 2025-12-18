# Envoy: Authorization via OIDC (OpenID-Connect)

For a more production like setup a Azure Kubernetes Cluster was created and Azure EntraID is used as OIDC Provider.
Prerequisites:

- AKS Cluster with default configuration, Envoy Gateway installed and setup as described in 1-kong-setup.md and 2--https.md
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

## Setup OIDC according to Kong Docs

https://developer.konghq.com/kubernetes-ingress-controller/oidc/

OIDC is an Enterprise Plugin, an Account has to be made to start 30 Trial.
Request a [PAT](https://cloud.konghq.com/global/account/tokens) and put it in your .env file

```sh
export $(cat ../.env | xargs)
# Or provide directly:
# export KONNECT_TOKEN=fill_me
```

Use the Konnect API to create a new CLUSTER_TYPE_K8S_INGRESS_CONTROLLER Control Plane:

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

Create and use mTLS certificates, they will be used for KIC <-> Konnect communication

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

As we now use a managed control plane (konnect) the install has to be adapted to change from self hosted to managed:

Note: This will overwrite our High Available configuration done in 1-kong-setup.md but for OIDC demonstrating purposes this is fine.

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

Set `$PROXY_IP` as an environment variable for future commands:

```sh
export PROXY_IP=$(kubectl get svc --namespace kong kong-gateway-proxy -o jsonpath='{range .status.loadBalancer.ingress[0]}{@.ip}{@.hostname}{end}')
echo $PROXY_IP

```

Apply KongPlugin openid-connect which configures to attach OIDC Auth to all routes the gateway manages.
It is configured to use Azure as OIDC Provider.

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

Apply KongPlugin openid-connect which configures to attach OIDC Auth to all routes the gateway manages.
It is configured to use Azure as OIDC Provider.

```sh
kubectl apply -f 3-kongplugin-oidc.yml
```

The Cluster does not have a Domain. Get the Public IP of the Cluster and change your /etc/hosts file so that www.example.com points to this ip

```sh
export GATEWAY_HOST=$(kubectl get gateway gateway -o jsonpath='{.status.addresses[0].value}')

echo "Add the following to /etc/hosts:"
echo "$GATEWAY_HOST www.example.com"

```

## Test Changes

If you now visit www.example.com (www is important!) you will be redirected to Azure to sign in with your account. After logging in you will be redirected to the Demo Web App.