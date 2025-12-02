# Kubernetes Deployment for Enterprise Authentication System

This directory contains Kubernetes manifests for deploying the Enterprise Authentication System in a production-ready, highly available configuration.

## Architecture Overview

The deployment includes:
- **3 replicas** (minimum) with horizontal pod autoscaling up to 10 pods
- **Resource limits** and requests for optimal scheduling
- **Liveness, readiness, and startup probes** for health monitoring
- **Pod disruption budget** to ensure availability during updates
- **Network policies** for security isolation
- **Service account with RBAC** for least-privilege access
- **ConfigMap** for non-sensitive configuration
- **Secrets** for sensitive data (credentials, API keys)
- **Ingress** with TLS termination
- **HorizontalPodAutoscaler** for automatic scaling based on CPU/memory

## Directory Structure

```
kubernetes/
├── base/                           # Base Kubernetes manifests
│   ├── namespace.yaml             # Namespace definition
│   ├── configmap.yaml             # Non-sensitive configuration
│   ├── secret.yaml                # Sensitive credentials (template)
│   ├── serviceaccount.yaml        # Service account and RBAC
│   ├── deployment.yaml            # Main application deployment
│   ├── service.yaml               # Service definitions
│   ├── hpa.yaml                   # Horizontal Pod Autoscaler
│   ├── pdb.yaml                   # Pod Disruption Budget
│   ├── ingress.yaml               # Ingress configuration
│   ├── networkpolicy.yaml         # Network security policies
│   └── kustomization.yaml         # Kustomize configuration
├── overlays/                       # Environment-specific overlays
│   ├── production/                # Production configuration
│   │   ├── kustomization.yaml
│   │   ├── deployment-patch.yaml
│   │   └── hpa-patch.yaml
│   ├── staging/                   # Staging configuration
│   │   ├── kustomization.yaml
│   │   └── deployment-patch.yaml
│   └── development/               # Development configuration
│       ├── kustomization.yaml
│       └── deployment-patch.yaml
└── README.md                      # This file
```

## Prerequisites

1. **Kubernetes Cluster** (v1.24+)
   - Managed Kubernetes (EKS, GKE, AKS) or self-hosted
   - Metrics Server installed for HPA
   - Ingress Controller (NGINX or AWS ALB)

2. **kubectl** CLI tool installed and configured

3. **kustomize** (optional, but recommended)
   ```bash
   kubectl kustomize --help
   ```

4. **External Dependencies**:
   - PostgreSQL database (can be deployed separately or use managed service)
   - Redis cache (can be deployed separately or use managed service)

## Configuration

### 1. Update Secrets

**IMPORTANT**: Before deploying, update the secrets in `base/secret.yaml`:

```bash
# Generate RSA keys for JWT
openssl genrsa -out private.pem 4096
openssl rsa -in private.pem -pubout -out public.pem

# Update the secret.yaml file with your actual credentials
# DO NOT commit real secrets to version control!
```

Required secrets to update:
- Database credentials (`DB_USER`, `DB_PASSWORD`, `DATABASE_URL`)
- Redis password (`REDIS_PASSWORD`)
- JWT secrets and RSA keys
- Email SMTP credentials
- Twilio SMS credentials
- OAuth provider credentials (Google, GitHub, Microsoft)
- CORS origins

### 2. Update ConfigMap

Update `base/configmap.yaml` with your environment-specific values:
- Database host and port
- Redis host and port
- CORS origins
- Feature flags
- Rate limiting thresholds

### 3. Update Ingress

Update `base/ingress.yaml` with your domain:
```yaml
spec:
  tls:
    - hosts:
        - auth.your-domain.com  # Change this
      secretName: enterprise-auth-tls
  rules:
    - host: auth.your-domain.com  # Change this
```

## Deployment

### Using kubectl with kustomize

#### Development Environment
```bash
# Apply development configuration
kubectl apply -k overlays/development/

# Verify deployment
kubectl get pods -n enterprise-auth-dev
kubectl get svc -n enterprise-auth-dev
```

#### Staging Environment
```bash
# Apply staging configuration
kubectl apply -k overlays/staging/

# Verify deployment
kubectl get pods -n enterprise-auth-staging
kubectl get svc -n enterprise-auth-staging
```

#### Production Environment
```bash
# Apply production configuration
kubectl apply -k overlays/production/

# Verify deployment
kubectl get pods -n enterprise-auth-prod
kubectl get svc -n enterprise-auth-prod
kubectl get hpa -n enterprise-auth-prod
```

### Using kubectl directly (base manifests)

```bash
# Create namespace
kubectl apply -f base/namespace.yaml

# Apply all base manifests
kubectl apply -f base/

# Verify deployment
kubectl get all -n enterprise-auth
```

## Monitoring

### Check Pod Status
```bash
kubectl get pods -n enterprise-auth -w
```

### View Logs
```bash
# View logs from all pods
kubectl logs -n enterprise-auth -l app=enterprise-auth --tail=100 -f

# View logs from specific pod
kubectl logs -n enterprise-auth <pod-name> -f
```

### Check Health
```bash
# Port forward to access health endpoint
kubectl port-forward -n enterprise-auth svc/enterprise-auth-service 8080:80

# Check health
curl http://localhost:8080/api/v1/health
```

### Check Metrics
```bash
# Port forward to metrics endpoint
kubectl port-forward -n enterprise-auth svc/enterprise-auth-metrics 9090:9090

# Access Prometheus metrics
curl http://localhost:9090/metrics
```

### Check HPA Status
```bash
kubectl get hpa -n enterprise-auth
kubectl describe hpa enterprise-auth-hpa -n enterprise-auth
```

## Scaling

### Manual Scaling
```bash
# Scale to specific number of replicas
kubectl scale deployment enterprise-auth -n enterprise-auth --replicas=5
```

### Automatic Scaling
The HorizontalPodAutoscaler automatically scales based on:
- CPU utilization (target: 70%)
- Memory utilization (target: 80%)

Configuration:
- **Development**: 1-3 replicas
- **Staging**: 2-5 replicas
- **Production**: 5-20 replicas

## Updates and Rollouts

### Rolling Update
```bash
# Update image
kubectl set image deployment/enterprise-auth \
  enterprise-auth=your-registry/enterprise-auth:v1.1.0 \
  -n enterprise-auth

# Check rollout status
kubectl rollout status deployment/enterprise-auth -n enterprise-auth
```

### Rollback
```bash
# Rollback to previous version
kubectl rollout undo deployment/enterprise-auth -n enterprise-auth

# Rollback to specific revision
kubectl rollout undo deployment/enterprise-auth -n enterprise-auth --to-revision=2
```

### View Rollout History
```bash
kubectl rollout history deployment/enterprise-auth -n enterprise-auth
```

## Troubleshooting

### Pod Not Starting
```bash
# Describe pod to see events
kubectl describe pod <pod-name> -n enterprise-auth

# Check init container logs
kubectl logs <pod-name> -n enterprise-auth -c wait-for-postgres
kubectl logs <pod-name> -n enterprise-auth -c wait-for-redis
```

### Connection Issues
```bash
# Test database connectivity
kubectl run -it --rm debug --image=postgres:16 --restart=Never -n enterprise-auth -- \
  psql -h postgresql-service -U postgres -d enterprise_auth

# Test Redis connectivity
kubectl run -it --rm debug --image=redis:7 --restart=Never -n enterprise-auth -- \
  redis-cli -h redis-service ping
```

### Resource Issues
```bash
# Check resource usage
kubectl top pods -n enterprise-auth
kubectl top nodes

# Check events
kubectl get events -n enterprise-auth --sort-by='.lastTimestamp'
```

## Security Considerations

1. **Secrets Management**: Use external secret management (e.g., AWS Secrets Manager, HashiCorp Vault, Sealed Secrets)
2. **Network Policies**: Ensure network policies are enforced in your cluster
3. **RBAC**: Service account has minimal required permissions
4. **Pod Security**: Runs as non-root user with read-only root filesystem
5. **TLS**: Ensure TLS certificates are properly configured for ingress
6. **Image Security**: Scan images for vulnerabilities before deployment

## Resource Requirements

### Per Pod (Base Configuration)
- **Requests**: 500m CPU, 512Mi memory
- **Limits**: 2000m CPU, 2Gi memory

### Production Cluster Recommendations
- **Minimum**: 3 nodes with 4 CPU, 8GB RAM each
- **Recommended**: 5+ nodes with 8 CPU, 16GB RAM each
- **Storage**: Persistent volumes for PostgreSQL and Redis

## High Availability

The deployment ensures high availability through:
1. **Multiple replicas** (minimum 3) across different nodes
2. **Pod anti-affinity** to spread pods across nodes
3. **Pod disruption budget** (minimum 2 available)
4. **Liveness and readiness probes** for automatic recovery
5. **Rolling updates** with zero downtime
6. **HPA** for automatic scaling under load

## Backup and Disaster Recovery

Ensure you have:
1. **Database backups** (automated daily backups)
2. **Redis persistence** (RDB or AOF)
3. **Configuration backups** (store manifests in version control)
4. **Disaster recovery plan** documented

## Performance Tuning

### Database Connection Pool
Adjust in ConfigMap:
```yaml
DB_POOL_MIN: "2"
DB_POOL_MAX: "20"
```

### Redis Configuration
For high-traffic scenarios, consider Redis Cluster:
```yaml
REDIS_CLUSTER_ENABLED: "true"
REDIS_CLUSTER_NODES: "redis-0:6379,redis-1:6379,redis-2:6379"
```

### HPA Tuning
Adjust scaling thresholds in `hpa.yaml` based on your traffic patterns.

## Support

For issues or questions:
1. Check pod logs: `kubectl logs -n enterprise-auth -l app=enterprise-auth`
2. Check events: `kubectl get events -n enterprise-auth`
3. Review metrics: Access Prometheus metrics endpoint
4. Consult the main project documentation

## License

See the main project LICENSE file.
