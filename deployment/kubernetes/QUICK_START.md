# Quick Start Guide - Kubernetes Deployment

This guide will help you quickly deploy the Enterprise Authentication System to Kubernetes.

## Prerequisites Checklist

- [ ] Kubernetes cluster (v1.24+) is running
- [ ] `kubectl` is installed and configured
- [ ] PostgreSQL database is available
- [ ] Redis cache is available
- [ ] You have cluster admin access

## 5-Minute Deployment

### Step 1: Update Secrets (CRITICAL!)

```bash
cd deployment/kubernetes/base

# Edit secret.yaml and replace ALL "CHANGE_ME_IN_PRODUCTION" values
nano secret.yaml

# Generate JWT RSA keys
openssl genrsa -out private.pem 4096
openssl rsa -in private.pem -pubout -out public.pem

# Copy the keys into secret.yaml under enterprise-auth-jwt-keys
```

### Step 2: Update Configuration

```bash
# Edit configmap.yaml
nano configmap.yaml

# Update these values:
# - DB_HOST (your PostgreSQL host)
# - REDIS_HOST (your Redis host)
# - CORS_ORIGIN (your frontend URLs)
```

### Step 3: Update Ingress

```bash
# Edit ingress.yaml
nano ingress.yaml

# Update:
# - host: auth.your-domain.com (replace with your domain)
# - TLS certificate configuration
```

### Step 4: Deploy

```bash
# For development
./deploy.sh deploy development

# For staging
./deploy.sh deploy staging

# For production
./deploy.sh deploy production
```

### Step 5: Verify

```bash
# Check status
./deploy.sh status production

# Check logs
./deploy.sh logs production

# Test health endpoint
kubectl port-forward -n enterprise-auth-prod svc/prod-enterprise-auth-service 8080:80
curl http://localhost:8080/api/v1/health
```

## Common Operations

### View Logs
```bash
./deploy.sh logs production
```

### Scale Up/Down
```bash
./deploy.sh scale production 10
```

### Restart Deployment
```bash
./deploy.sh restart production
```

### Update Application
```bash
# Update image tag in overlays/production/kustomization.yaml
# Then redeploy
./deploy.sh deploy production
```

### Rollback
```bash
kubectl rollout undo deployment/enterprise-auth -n enterprise-auth-prod
```

## Troubleshooting

### Pods Not Starting?
```bash
# Check pod status
kubectl get pods -n enterprise-auth-prod

# Describe pod
kubectl describe pod <pod-name> -n enterprise-auth-prod

# Check logs
kubectl logs <pod-name> -n enterprise-auth-prod
```

### Can't Connect to Database?
```bash
# Test database connection
kubectl run -it --rm debug --image=postgres:16 --restart=Never -n enterprise-auth-prod -- \
  psql -h <DB_HOST> -U <DB_USER> -d enterprise_auth
```

### Can't Connect to Redis?
```bash
# Test Redis connection
kubectl run -it --rm debug --image=redis:7 --restart=Never -n enterprise-auth-prod -- \
  redis-cli -h <REDIS_HOST> ping
```

## Security Checklist

Before going to production:

- [ ] All secrets updated with strong, unique values
- [ ] JWT RSA keys generated and configured
- [ ] Database credentials are secure
- [ ] OAuth credentials configured
- [ ] TLS certificates configured for ingress
- [ ] Network policies reviewed
- [ ] RBAC permissions reviewed
- [ ] Resource limits appropriate for your workload
- [ ] Monitoring and alerting configured
- [ ] Backup strategy in place

## Resource Requirements

### Development
- 1 pod: 100m CPU, 128Mi memory

### Staging
- 2 pods: 250m CPU, 256Mi memory each

### Production
- 5-20 pods (auto-scaled): 1 CPU, 1Gi memory each
- Recommended: 3+ nodes with 8 CPU, 16GB RAM each

## Next Steps

1. Configure monitoring (Prometheus/Grafana)
2. Set up log aggregation (ELK/Loki)
3. Configure alerting
4. Set up CI/CD pipeline
5. Configure backup automation
6. Document runbooks

## Support

For detailed documentation, see [README.md](./README.md)

For issues:
1. Check pod logs
2. Check events: `kubectl get events -n enterprise-auth-prod`
3. Review metrics
4. Consult main project documentation
