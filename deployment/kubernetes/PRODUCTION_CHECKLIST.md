# Production Deployment Checklist

Use this checklist before deploying to production to ensure everything is properly configured.

## Pre-Deployment Checklist

### 1. Secrets Configuration ✓
- [ ] All `CHANGE_ME_IN_PRODUCTION` values replaced in `base/secret.yaml`
- [ ] JWT RSA keys generated (4096-bit)
- [ ] Database credentials configured with strong passwords
- [ ] Redis password set (if using authentication)
- [ ] SMTP credentials configured and tested
- [ ] Twilio credentials configured (if using SMS MFA)
- [ ] OAuth provider credentials configured:
  - [ ] Google OAuth
  - [ ] GitHub OAuth
  - [ ] Microsoft OAuth
- [ ] CORS origins updated with production URLs
- [ ] Secrets stored in external secret manager (recommended)

### 2. ConfigMap Configuration ✓
- [ ] Database host and port updated
- [ ] Redis host and port updated
- [ ] NODE_ENV set to "production"
- [ ] LOG_LEVEL set appropriately (info or warn)
- [ ] Rate limiting thresholds reviewed
- [ ] Session expiry settings reviewed
- [ ] Feature flags configured
- [ ] Monitoring endpoints configured

### 3. Ingress Configuration ✓
- [ ] Domain name updated in `base/ingress.yaml`
- [ ] TLS certificate configured
- [ ] Certificate issuer configured (cert-manager or manual)
- [ ] CORS settings reviewed
- [ ] Rate limiting configured
- [ ] Security headers configured

### 4. Resource Configuration ✓
- [ ] CPU requests and limits appropriate for workload
- [ ] Memory requests and limits appropriate for workload
- [ ] HPA min/max replicas configured
- [ ] HPA metrics thresholds reviewed
- [ ] PDB minAvailable set appropriately

### 5. Security Configuration ✓
- [ ] Service account with minimal permissions
- [ ] RBAC roles and bindings reviewed
- [ ] Network policies configured
- [ ] Pod security context configured (non-root user)
- [ ] Container security context configured
- [ ] Read-only root filesystem enabled
- [ ] Security headers configured in ingress

### 6. High Availability ✓
- [ ] Minimum 3 replicas configured
- [ ] Pod anti-affinity rules configured
- [ ] Pod disruption budget configured
- [ ] Multiple availability zones used (if applicable)
- [ ] Health probes configured:
  - [ ] Liveness probe
  - [ ] Readiness probe
  - [ ] Startup probe

### 7. Monitoring & Observability ✓
- [ ] Prometheus metrics enabled
- [ ] Metrics endpoint accessible
- [ ] OpenTelemetry configured (if using)
- [ ] Structured logging enabled (JSON format)
- [ ] Log aggregation configured
- [ ] Alerting rules configured
- [ ] Dashboards created

### 8. Database & Cache ✓
- [ ] PostgreSQL database created
- [ ] Database migrations run
- [ ] Database backups configured
- [ ] Database connection pooling configured
- [ ] Redis instance available
- [ ] Redis persistence configured (if needed)
- [ ] Redis backup strategy in place

### 9. External Dependencies ✓
- [ ] SMTP server accessible
- [ ] Twilio API accessible (if using SMS)
- [ ] OAuth providers configured and tested
- [ ] Webhook endpoints accessible
- [ ] External services whitelisted in network policies

### 10. Testing ✓
- [ ] Manifests validated (`./validate.sh`)
- [ ] Dry-run deployment successful
- [ ] Health endpoint responds correctly
- [ ] Metrics endpoint accessible
- [ ] Authentication flow tested
- [ ] MFA flow tested (if enabled)
- [ ] OAuth flows tested (if enabled)
- [ ] Rate limiting tested
- [ ] Load testing completed

## Deployment Steps

### Step 1: Validate Configuration
```bash
cd deployment/kubernetes
./validate.sh
```

### Step 2: Dry Run
```bash
kubectl apply -k overlays/production/ --dry-run=server
```

### Step 3: Deploy
```bash
./deploy.sh deploy production
```

### Step 4: Verify Deployment
```bash
./deploy.sh status production
```

### Step 5: Check Health
```bash
kubectl port-forward -n enterprise-auth-prod svc/prod-enterprise-auth-service 8080:80
curl http://localhost:8080/api/v1/health
```

### Step 6: Monitor Rollout
```bash
kubectl rollout status deployment/prod-enterprise-auth -n enterprise-auth-prod
```

### Step 7: Check Logs
```bash
./deploy.sh logs production
```

### Step 8: Verify Metrics
```bash
kubectl port-forward -n enterprise-auth-prod svc/prod-enterprise-auth-metrics 9090:9090
curl http://localhost:9090/metrics
```

## Post-Deployment Checklist

### Immediate (0-1 hour)
- [ ] All pods are running
- [ ] Health checks passing
- [ ] No error logs
- [ ] Metrics being collected
- [ ] Can authenticate successfully
- [ ] Can access protected endpoints
- [ ] Rate limiting working
- [ ] Database connections stable
- [ ] Redis connections stable

### Short-term (1-24 hours)
- [ ] Monitor error rates
- [ ] Monitor response times
- [ ] Monitor resource usage
- [ ] Check for memory leaks
- [ ] Verify HPA scaling works
- [ ] Test failover scenarios
- [ ] Verify backup jobs running
- [ ] Check audit logs

### Medium-term (1-7 days)
- [ ] Review performance metrics
- [ ] Analyze user behavior
- [ ] Check for security incidents
- [ ] Review and tune resource limits
- [ ] Review and tune HPA settings
- [ ] Optimize database queries if needed
- [ ] Review cache hit rates
- [ ] Plan capacity scaling

## Rollback Plan

If issues occur:

### Quick Rollback
```bash
kubectl rollout undo deployment/prod-enterprise-auth -n enterprise-auth-prod
```

### Rollback to Specific Version
```bash
kubectl rollout history deployment/prod-enterprise-auth -n enterprise-auth-prod
kubectl rollout undo deployment/prod-enterprise-auth -n enterprise-auth-prod --to-revision=<revision>
```

### Complete Removal
```bash
./deploy.sh delete production
```

## Emergency Contacts

Document your emergency contacts:
- [ ] DevOps Lead: _______________
- [ ] Database Admin: _______________
- [ ] Security Team: _______________
- [ ] On-Call Engineer: _______________

## Incident Response

In case of incidents:
1. Check pod status and logs
2. Check metrics and alerts
3. Review recent changes
4. Check external dependencies
5. Scale up if needed
6. Rollback if necessary
7. Document incident
8. Post-mortem analysis

## Maintenance Windows

Document your maintenance schedule:
- [ ] Regular maintenance window: _______________
- [ ] Emergency maintenance process: _______________
- [ ] Change approval process: _______________

## Compliance & Audit

- [ ] Security audit completed
- [ ] Compliance requirements met (GDPR, HIPAA, etc.)
- [ ] Audit logging enabled
- [ ] Data retention policies configured
- [ ] Backup retention policies configured
- [ ] Disaster recovery plan documented
- [ ] Incident response plan documented

## Documentation

- [ ] Architecture diagram updated
- [ ] Runbooks created
- [ ] Troubleshooting guide created
- [ ] API documentation published
- [ ] User documentation updated
- [ ] Team trained on new deployment

## Sign-off

- [ ] Technical Lead: _______________ Date: _______________
- [ ] Security Team: _______________ Date: _______________
- [ ] Operations Team: _______________ Date: _______________
- [ ] Product Owner: _______________ Date: _______________

---

**Note**: This checklist should be reviewed and updated regularly based on your organization's requirements and lessons learned from deployments.
