# k8s-ingress-controller-comparison-and-benchmark

## Prerequisites

- Kubectl: https://kubernetes.io/docs/tasks/tools/ (Version used: v1.34.1)
- Docker Engine - Community: https://docs.docker.com/engine/install/ (Version used: 29.1.2)
- Kind: https://kind.sigs.k8s.io/docs/user/quick-start/#installation  (Version used: kind v0.30.0 go1.24.6 linux/amd64)
- Kubernetes Version 1.34.0 (automatically configured in kind-config-3-worker-nodes.yml)
- Helm https://helm.sh/docs/intro/install (Version used: 4.0.1)
- openssl (Version used 3.0.2)

## Deployment & Production Configuration

All gateways were initially deployed using the standard Quickstart Guide. Afterwards, a more production-grade configuration was uniformly applied to all three gateways, incorporating the following features:

- Access Logs: Enabled
- High Availability: Configured with a minimum of two gateway replicas running on separate nodes.
- Gateway API CRDs: Automatic creation of "Gateway" and "GatewayClass" resources was disabled

## Miscellaneous

If you get Pod errors due to “[too many open files](https://kind.sigs.k8s.io/docs/user/known-issues/#pod-errors-due-to-too-many-open-files)” this commands will increase limits on your host:

```sh
sudo sysctl fs.inotify.max_user_watches=524288
sudo sysctl fs.inotify.max_user_instances=512
```
