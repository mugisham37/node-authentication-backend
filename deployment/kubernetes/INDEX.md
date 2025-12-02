# Kubernetes Deployment - Documentation Index

Quick navigation guide for all Kubernetes deployment documentation.

## 📚 Documentation Files

### Getting Started
1. **[QUICK_START.md](./QUICK_START.md)** - 5-minute deployment guide
   - Prerequisites checklist
   - Quick deployment steps
   - Common operations
   - Troubleshooting basics

2. **[README.md](./README.md)** - Comprehensive deployment guide
   - Architecture overview
   - Detailed configuration instructions
   - Deployment procedures
   - Monitoring and scaling
   - Complete troubleshooting guide

### Pre-Deployment
3. **[PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)** - Production readiness checklist
   - Pre-deployment verification
   - Security checklist
   - Configuration validation
   - Post-deployment monitoring
   - Rollback procedures

### Reference
4. **[MANIFEST_SUMMARY.md](./MANIFEST_SUMMARY.md)** - Technical reference
   - Complete manifest overview
   - Resource requirements
   - Architecture diagrams
   - Security features
   - Best practices

## 🛠️ Scripts

### Deployment Script
**[deploy.sh](./deploy.sh)** - Main deployment automation
```bash
./deploy.sh deploy production    # Deploy to production
./deploy.sh status production     # Check status
./deploy.sh logs production       # View logs
./deploy.sh scale production 10   # Scale to 10 replicas
./deploy.sh restart production    # Rolling restart
```

### Validation Script
**[validate.sh](./validate.sh)** - Manifest validation
```bash
./validate.sh                     # Validate all manifests
```

## 📁 Manifest Files

### Base Manifests (`base/`)
Core Kubernetes resources that are common across all environments:

| File | Description |
|------|-------------|
| `namespace.yaml` | Namespace definition |
| `configmap.yaml` | Application configuration |
| `secret.yaml` | Sensitive credentials (template) |
| `serviceaccount.yaml` | RBAC configuration |
| `deployment.yaml` | Application deployment (3 replicas) |
| `service.yaml` | Service definitions |
| `hpa.yaml` | Horizontal Pod Autoscaler |
| `pdb.yaml` | Pod Disruption Budget |
| `ingress.yaml` | Ingress configuration |
| `networkpolicy.yaml` | Network security policies |
| `kustomization.yaml` | Kustomize configuration |

### Environment Overlays (`overlays/`)
Environment-specific configurations:

#### Production (`overlays/production/`)
- 5-20 replicas with aggressive scaling
- High resource limits (4 CPU, 4Gi memory)
- Production-grade monitoring

#### Staging (`overlays/staging/`)
- 2-5 replicas with moderate scaling
- Medium resource limits (1 CPU, 1Gi memory)
- Debug logging enabled

#### Development (`overlays/development/`)
- 1-3 replicas with minimal scaling
- Low resource limits (500m CPU, 512Mi memory)
- Verbose logging enabled

## 🚀 Quick Reference

### First Time Setup
1. Read [QUICK_START.md](./QUICK_START.md)
2. Update secrets in `base/secret.yaml`
3. Update configuration in `base/configmap.yaml`
4. Update domain in `base/ingress.yaml`
5. Run `./validate.sh`
6. Run `./deploy.sh deploy <environment>`

### Before Production Deployment
1. Complete [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)
2. Run `./validate.sh`
3. Test in staging first
4. Review [README.md](./README.md) security section
5. Deploy to production

### Daily Operations
- **Check Status**: `./deploy.sh status production`
- **View Logs**: `./deploy.sh logs production`
- **Scale**: `./deploy.sh scale production <replicas>`
- **Restart**: `./deploy.sh restart production`

### Troubleshooting
1. Check [README.md](./README.md) troubleshooting section
2. Run `kubectl get events -n <namespace>`
3. Check pod logs: `kubectl logs <pod-name> -n <namespace>`
4. Describe pod: `kubectl describe pod <pod-name> -n <namespace>`

## 📊 Architecture Overview

```
Internet
   ↓
Ingress (TLS, Load Balancing)
   ↓
Service (ClusterIP)
   ↓
Pods (3-20 replicas, auto-scaled)
   ↓
PostgreSQL + Redis + External Services
```

## 🔒 Security Features

- Non-root user execution
- Read-only root filesystem
- Network policies
- RBAC with minimal permissions
- TLS encryption
- Secrets management
- Security context hardening

## 📈 Monitoring

- Prometheus metrics on port 9090
- Structured JSON logs
- OpenTelemetry tracing
- Health check endpoints
- Resource usage metrics

## 🔄 Update Process

1. Update image tag in `overlays/<env>/kustomization.yaml`
2. Run `./validate.sh`
3. Run `./deploy.sh deploy <environment>`
4. Monitor rollout
5. Verify health
6. Rollback if needed

## 📞 Support

### Documentation
- [README.md](./README.md) - Comprehensive guide
- [QUICK_START.md](./QUICK_START.md) - Quick reference
- [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) - Pre-deployment checklist
- [MANIFEST_SUMMARY.md](./MANIFEST_SUMMARY.md) - Technical reference

### Tools
- `./deploy.sh` - Deployment automation
- `./validate.sh` - Manifest validation

### Kubernetes Commands
```bash
# Get resources
kubectl get all -n <namespace>

# Describe resource
kubectl describe <resource> <name> -n <namespace>

# View logs
kubectl logs <pod-name> -n <namespace> -f

# Execute command in pod
kubectl exec -it <pod-name> -n <namespace> -- /bin/sh

# Port forward
kubectl port-forward -n <namespace> svc/<service-name> <local-port>:<remote-port>
```

## 🎯 Next Steps

### For First-Time Users
1. Start with [QUICK_START.md](./QUICK_START.md)
2. Deploy to development environment
3. Test thoroughly
4. Move to staging
5. Review [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)
6. Deploy to production

### For Experienced Users
1. Review [MANIFEST_SUMMARY.md](./MANIFEST_SUMMARY.md)
2. Customize manifests for your needs
3. Update secrets and configuration
4. Run `./validate.sh`
5. Deploy with `./deploy.sh`

### For Operations Teams
1. Read [README.md](./README.md) monitoring section
2. Set up alerting rules
3. Configure log aggregation
4. Create runbooks
5. Test disaster recovery

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Status**: Production Ready ✓

For questions or issues, start with the [README.md](./README.md) troubleshooting section.
