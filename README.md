# k8s-ingress-controller-comparison-and-benchmark

This repository is part of my bachelor’s thesis, comparing the developer experience and performance of Traefik, Kong, and Envoy Gateway.

## Prerequisites

- Kubectl: https://kubernetes.io/docs/tasks/tools/ (Version used: v1.34.1)
- Docker Engine - Community: https://docs.docker.com/engine/install/ (Version used: 29.1.2)
- Kind: https://kind.sigs.k8s.io/docs/user/quick-start/#installation (Version used: kind v0.30.0 go1.24.6 linux/amd64)
- Kubernetes Version 1.34.0 (automatically configured in kind-config-3-worker-nodes.yml)
- Helm: https://helm.sh/docs/intro/install (Version used: 4.0.1)
- openssl (Version used: 3.0.2)
- jq (Optional, Version used: 1.6)

**Higly Recommended:** The VS Code Extension [RunMe](https://marketplace.visualstudio.com/items?itemName=stateful.runme) to easily execute provided bash commands directly from the markdown document.

## Miscellaneous

If you get Pod errors due to "[too many open files](https://kind.sigs.k8s.io/docs/user/known-issues/#pod-errors-due-to-too-many-open-files)", these commands will increase the limits on your host:

```sh
sudo sysctl fs.inotify.max_user_watches=524288
sudo sysctl fs.inotify.max_user_instances=512
```
