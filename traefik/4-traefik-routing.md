---
shell: bash
---

# Traefik: Routing

Path- and Host based routing will be tested.
Prerequisites:

- Traefik installed and setup as described in `1-traefik-setup.md` and `2-traefik-https.md` with a local cluster.

Deploy two Web Apps to test Routing. Corresponding Service is also included in the file.

```sh
kubectl apply -f ../common_config_files/web-app-1.yml
kubectl apply -f ../common_config_files/web-app-2.yml
```

Both Web Apps should now be running:

```sh
kubectl get deployment
kubectl get pods
```

## Path-based Routing

Apply the defined HTTPRoute that defined path based routes:

```sh
kubectl apply -f ../common_config_files/routing-by-path.yml
```

### Test Routing

Verify the applications are now accessible on via their configured path (make sure to cancel earlier port-forward):

```sh
kubectl port-forward -n traefik service/traefik 8000:80 8443:443
```

```sh
echo "App 1:"
curl http://web-app.localhost:8000/app1
echo "App 2:"
curl http://web-app.localhost:8000/app2
```

Similary via HTTPS connection:

```sh
kubectl get secret root-secret -n cert-manager -o jsonpath='{.data.tls\.crt}' | base64 -d > ca.crt
echo "App 1:"
curl --cacert ca.crt https://web-app.localhost:8443/app1
echo "App 2:"
curl --cacert ca.crt https://web-app.localhost:8443/app2
```

## Host-based Routing

Apply the defined HTTPRoutes that defined host based routes:

```sh
kubectl apply -f ../common_config_files/routing-by-host.yml
```

```sh
echo "App 1:"
curl --header "Host: a.web-app.localhost" http://web-app.localhost:8000
echo "App 2:"
curl --header "Host: b.web-app.localhost" http://web-app.localhost:8000
```

Similary via HTTPS connection:

```sh
echo "App 1:"
curl --cacert ca.crt --header "Host: a.web-app.localhost" https://web-app.localhost:8443
echo "App 2:"
curl --cacert ca.crt --header "Host: b.web-app.localhost" https://web-app.localhost:8443
```
