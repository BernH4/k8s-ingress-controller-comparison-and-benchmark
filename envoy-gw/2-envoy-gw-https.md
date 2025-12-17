---
shell: bash
---

# Envoy: Encrypted communicaton between Clients <-> Gateway

- Make sure Cluster is running and set up according to production section in 1-envoy-gw-setup.md
- The Gateway and HTTPRoute Ressources are already configured to work with https connections

## Install cert-manager (exactly same deployment used with other gateways)

- https://cert-manager.io/docs/installation/helm/#installing-from-the-oci-registry
- https://cert-manager.io/docs/usage/gateway/

```sh
helm install \
  cert-manager oci://quay.io/jetstack/charts/cert-manager \
  --version v1.19.2 \
  --namespace cert-manager \
  --create-namespace \
  --set crds.enabled=true \
  --set config.apiVersion="controller.config.cert-manager.io/v1alpha1" \
  --set config.kind="ControllerConfiguration" \
  --set config.enableGatewayAPI=true
```

Create own internal Certificate Authority that will sign our applicaton certificates:

```sh
kubectl apply -f ../common_config_files/cert-manager/ca-config.yml
```

Advise cert-manager to create and sign a certificate for our application:

```sh

kubectl apply -f ../common_config_files/cert-manager/certificate.yml
```

### Test Application

Verify the application is accessible via https (make sure to cancel earlier port-forward):

```sh
export ENVOY_SERVICE=$(kubectl get svc -n envoy-gateway-system --selector=gateway.envoyproxy.io/owning-gateway-namespace=default,gateway.envoyproxy.io/owning-gateway-name=gateway -o jsonpath='{.items[0].metadata.name}')

kubectl -n envoy-gateway-system port-forward service/${ENVOY_SERVICE} 8443:443

```

Because we are using a local CA, browsers and tools will treat the certificate as insecure. Fix this by exporting the Root CA and importing it to the Operating System or tell curl to trust it using the `--cacert` flag:

```sh
kubectl get secret root-secret -n cert-manager -o jsonpath='{.data.tls\.crt}' | base64 -d > ca.crt
curl --cacert ca.crt https://web-app.localhost:8443
```

Optionally, you can extract the Root CA certificate from the cluster and add it to your local trust store to avoid self-signed certificate warnings:

```sh
# Extract root cert to 'ca.crt'
kubectl get secret root-secret -n cert-manager -o jsonpath='{.data.tls\.crt}' | base64 -d > ca.crt

# Now import it in your OS or Browser
```
