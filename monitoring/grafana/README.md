# Grafana Dashboards for Enterprise Auth System

This directory contains Grafana dashboard configurations for monitoring the Enterprise Authentication System. The dashboards provide comprehensive visibility into system performance, business metrics, and security events.

## Available Dashboards

### 1. System Metrics Dashboard (`system-metrics-dashboard.json`)

Monitors technical system performance and infrastructure health.

**Key Metrics:**
- **HTTP Request Rate**: Tracks incoming request volume by method, path, and status
- **HTTP Request Duration**: p95 and p99 latency metrics with 200ms threshold alert
- **Error Rate**: 4xx and 5xx error rates with alerting on high 5xx rates
- **Database Query Duration**: p95 and p99 query performance
- **Database Connection Pool**: Active, idle, and total connection tracking
- **Cache Hit Rate**: Cache effectiveness percentage
- **Cache Operations**: Hit, miss, and set operation rates
- **Job Queue Size**: Background job queue depth with alerting
- **Job Processing Duration**: Background job execution time
- **System Resource Usage**: CPU and memory utilization

**Alerts:**
- High HTTP Response Time (>200ms p95)
- High Error Rate (>10 errors/sec)
- High Job Queue Size (>1000 jobs)

**Use Cases:**
- Performance monitoring and optimization
- Capacity planning
- Infrastructure health checks
- SLA compliance verification

### 2. Business Metrics Dashboard (`business-metrics-dashboard.json`)

Tracks business-level metrics and user engagement.

**Key Metrics:**
- **User Registrations**: Registration rate and 24h totals
- **User Logins**: Successful and failed login rates
- **Login Success Rate**: Percentage of successful authentication attempts
- **Active Sessions**: Current number of active user sessions
- **MFA Enabled Users**: MFA adoption tracking
- **Password Resets**: Password reset request volume
- **Authentication Methods**: Distribution of auth methods (credentials, OAuth, passwordless)
- **Session Activity**: Session creation and revocation rates
- **Authentication Duration by Method**: Performance by auth method
- **Authorization Check Duration**: Permission check latency with 5ms threshold alert
- **Webhook Deliveries**: Success, failure, and retry rates
- **Webhook Delivery Duration**: Webhook execution time
- **User Growth Trend**: Daily registration trends

**Alerts:**
- Slow Authentication (>200ms p95)
- Slow Authorization (>5ms p95)

**Use Cases:**
- Product analytics
- User behavior analysis
- Feature adoption tracking
- Business KPI monitoring

### 3. Security Events Dashboard (`security-events-dashboard.json`)

Provides real-time security monitoring and threat detection.

**Key Metrics:**
- **Security Events Overview**: All security events by type and severity
- **Failed Login Attempts**: Failed authentication tracking by reason
- **Account Lockouts**: Account lockout rate and totals
- **Rate Limit Violations**: Rate limiting enforcement by endpoint
- **Security Events by Severity**: Distribution of critical, high, medium, low events
- **Critical Security Events**: Table of critical events requiring immediate attention
- **Authentication Attempts by IP**: Top IPs by authentication volume
- **Suspicious Activity Indicators**: Impossible travel, unusual locations, new devices, credential stuffing
- **MFA Verification Failures**: Failed MFA attempts by method
- **Password Reset Requests**: Password reset volume
- **Session Anomalies**: Session hijacking and token reuse detection
- **Authorization Failures**: Permission denial tracking
- **Top Failed Login IPs**: IPs with highest failed login counts
- **Security Event Timeline**: High and critical events over time

**Alerts:**
- High Security Event Rate (>50 events/sec)
- High Failed Login Rate (>10 attempts/sec) - possible brute force
- High Account Lockout Rate (>5 lockouts/sec)
- High Rate Limit Violations (>20 violations/sec) - possible DoS
- Session Security Anomaly (>1 event/sec) - possible attack

**Use Cases:**
- Security incident detection and response
- Threat monitoring
- Compliance auditing
- Attack pattern identification

## Installation

### Prerequisites

- Grafana 9.0 or higher
- Prometheus data source configured
- Enterprise Auth System exposing metrics at `/api/v1/metrics`

### Import Dashboards

1. **Via Grafana UI:**
   ```
   1. Navigate to Dashboards → Import
   2. Click "Upload JSON file"
   3. Select one of the dashboard JSON files
   4. Select your Prometheus data source
   5. Click "Import"
   ```

2. **Via Grafana API:**
   ```bash
   # System Metrics Dashboard
   curl -X POST http://localhost:3000/api/dashboards/db \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -d @system-metrics-dashboard.json

   # Business Metrics Dashboard
   curl -X POST http://localhost:3000/api/dashboards/db \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -d @business-metrics-dashboard.json

   # Security Events Dashboard
   curl -X POST http://localhost:3000/api/dashboards/db \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -d @security-events-dashboard.json
   ```

3. **Via Provisioning:**
   ```yaml
   # Add to grafana/provisioning/dashboards/dashboards.yml
   apiVersion: 1
   providers:
     - name: 'Enterprise Auth System'
       orgId: 1
       folder: 'Authentication'
       type: file
       disableDeletion: false
       updateIntervalSeconds: 10
       allowUiUpdates: true
       options:
         path: /path/to/monitoring/grafana
   ```

## Configuration

### Data Source

All dashboards expect a Prometheus data source. Configure the data source in Grafana:

```yaml
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

### Refresh Intervals

- **System Metrics**: 30 seconds (adjustable for high-frequency monitoring)
- **Business Metrics**: 1 minute (suitable for business analytics)
- **Security Events**: 30 seconds (critical for security monitoring)

### Time Ranges

- **System Metrics**: Last 1 hour (default)
- **Business Metrics**: Last 24 hours (default)
- **Security Events**: Last 6 hours (default)

All time ranges are adjustable via the dashboard time picker.

## Alert Configuration

### Notification Channels

Configure notification channels in Grafana to receive alerts:

1. **Email:**
   ```yaml
   notifiers:
     - name: Email Alerts
       type: email
       settings:
         addresses: ops-team@example.com
   ```

2. **Slack:**
   ```yaml
   notifiers:
     - name: Slack Alerts
       type: slack
       settings:
         url: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
         recipient: '#security-alerts'
   ```

3. **PagerDuty:**
   ```yaml
   notifiers:
     - name: PagerDuty
       type: pagerduty
       settings:
         integrationKey: YOUR_INTEGRATION_KEY
   ```

### Alert Rules

Each dashboard includes pre-configured alert rules. To enable:

1. Navigate to the panel with the alert
2. Click the panel title → Edit
3. Go to the Alert tab
4. Configure notification channels
5. Save the dashboard

## Customization

### Adding Custom Panels

1. Edit the dashboard in Grafana UI
2. Add new panel
3. Configure query using available metrics
4. Save dashboard
5. Export JSON to update the file

### Available Metrics

All metrics exposed by the system are documented in `src/core/monitoring/metrics.ts`. Key metric families:

- `http_requests_total` - HTTP request counter
- `http_request_duration_seconds` - HTTP request histogram
- `authentication_attempts_total` - Authentication counter
- `authentication_duration_seconds` - Authentication histogram
- `authorization_checks_total` - Authorization counter
- `authorization_duration_seconds` - Authorization histogram
- `database_queries_total` - Database query counter
- `database_query_duration_seconds` - Database query histogram
- `cache_operations_total` - Cache operation counter
- `user_registrations_total` - User registration counter
- `user_logins_total` - User login counter
- `security_events_total` - Security event counter
- `failed_login_attempts_total` - Failed login counter
- `rate_limit_exceeded_total` - Rate limit violation counter
- `webhook_deliveries_total` - Webhook delivery counter
- `active_sessions` - Active session gauge

### Modifying Thresholds

Alert thresholds can be adjusted in the JSON files:

```json
"alert": {
  "conditions": [
    {
      "evaluator": {
        "params": [0.2],  // Adjust this value
        "type": "gt"
      }
    }
  ]
}
```

## Best Practices

### Monitoring Strategy

1. **System Metrics**: Monitor continuously for performance degradation
2. **Business Metrics**: Review daily for trends and anomalies
3. **Security Events**: Monitor in real-time with alerting enabled

### Alert Fatigue Prevention

- Set appropriate thresholds based on baseline metrics
- Use alert grouping and deduplication
- Implement escalation policies
- Regular review and tuning of alert rules

### Performance Optimization

- Use recording rules in Prometheus for complex queries
- Limit time ranges for heavy queries
- Use dashboard variables for filtering
- Enable query caching in Grafana

## Troubleshooting

### No Data Displayed

1. Verify Prometheus is scraping metrics endpoint
2. Check data source configuration in Grafana
3. Verify metric names match those in the application
4. Check time range selection

### Slow Dashboard Loading

1. Reduce time range
2. Increase refresh interval
3. Simplify complex queries
4. Use Prometheus recording rules

### Alerts Not Firing

1. Verify notification channels are configured
2. Check alert rule conditions
3. Verify metrics are being collected
4. Check Grafana alert engine status

## Maintenance

### Regular Tasks

- **Weekly**: Review alert effectiveness and adjust thresholds
- **Monthly**: Update dashboards based on new features
- **Quarterly**: Archive old dashboards and create new versions

### Version Control

Keep dashboard JSON files in version control:
- Track changes over time
- Enable rollback if needed
- Document modifications in commit messages

## Support

For issues or questions:
- Check application logs for metric collection issues
- Review Prometheus targets for scraping status
- Consult Grafana documentation for dashboard features
- Contact the development team for metric-specific questions

## References

- [Grafana Documentation](https://grafana.com/docs/)
- [Prometheus Query Language](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Enterprise Auth System Metrics](../../src/core/monitoring/metrics.ts)
- [Requirements 22.1, 22.6](../../.kiro/specs/enterprise-auth-system/requirements.md)
