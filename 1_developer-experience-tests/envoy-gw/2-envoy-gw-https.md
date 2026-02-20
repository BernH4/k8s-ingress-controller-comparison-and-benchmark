---
shell: bash
---

# Envoy: Encrypted Communication between Clients and Gateway

- Make sure the cluster is running and set up according to the production section in `1-envoy-gw-setup.md`.
- The Gateway and HTTPRoute resources are already configured to work with HTTPS connections.

## Install cert-manager (exactly the same deployment used with other gateways)

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

Create own internal Certificate Authority that will sign the application certificates:

```sh
kubectl apply -f ../../common_config_files/cert-manager/ca-config.yml
```

Instruct cert-manager to create and sign a certificate for the application:

```sh

kubectl apply -f ../../common_config_files/cert-manager/certificate.yml
```

### Test Application

Verify the application is accessible via HTTPS (make sure to cancel the earlier port-forward):

```sh
export ENVOY_SERVICE=$(kubectl get svc -n envoy-gateway-system --selector=gateway.envoyproxy.io/owning-gateway-namespace=default,gateway.envoyproxy.io/owning-gateway-name=gateway -o jsonpath='{.items[0].metadata.name}')

kubectl -n envoy-gateway-system port-forward service/${ENVOY_SERVICE} 8443:443

```

Because a local CA is used, browsers and tools will treat the certificate as insecure. Fix this by exporting the root CA and importing it into the operating system, or tell curl to trust it using the `--cacert` flag:

```sh
kubectl get secret root-secret -n cert-manager -o jsonpath='{.data.tls\.crt}' | base64 -d > ca.crt
curl --cacert ca.crt https://web-app.localhost:8443
```
