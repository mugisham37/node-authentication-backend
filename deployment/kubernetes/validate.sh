#!/bin/bash

# Kubernetes Manifest Validation Script
# Validates all Kubernetes manifests before deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check if kubectl is installed
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed"
        exit 1
    fi
    print_success "kubectl is installed"
}

# Validate YAML syntax
validate_yaml_syntax() {
    print_info "Validating YAML syntax..."
    local errors=0
    
    for file in base/*.yaml overlays/*/*.yaml; do
        if [ -f "$file" ]; then
            if kubectl apply --dry-run=client -f "$file" &> /dev/null; then
                print_success "✓ $file"
            else
                print_error "✗ $file - Invalid YAML"
                errors=$((errors + 1))
            fi
        fi
    done
    
    if [ $errors -eq 0 ]; then
        print_success "All YAML files are valid"
        return 0
    else
        print_error "$errors file(s) have invalid YAML"
        return 1
    fi
}

# Check for placeholder values in secrets
check_secrets() {
    print_info "Checking for placeholder values in secrets..."
    
    if grep -q "CHANGE_ME_IN_PRODUCTION" base/secret.yaml; then
        print_warn "Found placeholder values in base/secret.yaml"
        print_warn "Please update secrets before deploying to production"
        return 1
    else
        print_success "No placeholder values found in secrets"
        return 0
    fi
}

# Validate kustomize builds
validate_kustomize() {
    print_info "Validating kustomize builds..."
    local errors=0
    
    for env in development staging production; do
        print_info "Building $env overlay..."
        if kubectl kustomize "overlays/$env/" > /dev/null 2>&1; then
            print_success "✓ $env overlay builds successfully"
        else
            print_error "✗ $env overlay failed to build"
            errors=$((errors + 1))
        fi
    done
    
    if [ $errors -eq 0 ]; then
        print_success "All kustomize overlays build successfully"
        return 0
    else
        print_error "$errors overlay(s) failed to build"
        return 1
    fi
}

# Check resource limits
check_resource_limits() {
    print_info "Checking resource limits..."
    
    if grep -q "resources:" base/deployment.yaml; then
        if grep -q "limits:" base/deployment.yaml && grep -q "requests:" base/deployment.yaml; then
            print_success "Resource limits and requests are defined"
            return 0
        else
            print_warn "Resource limits or requests are missing"
            return 1
        fi
    else
        print_error "No resource configuration found"
        return 1
    fi
}

# Check probes
check_probes() {
    print_info "Checking health probes..."
    local probes=("livenessProbe" "readinessProbe" "startupProbe")
    local missing=0
    
    for probe in "${probes[@]}"; do
        if grep -q "$probe:" base/deployment.yaml; then
            print_success "✓ $probe is configured"
        else
            print_warn "✗ $probe is missing"
            missing=$((missing + 1))
        fi
    done
    
    if [ $missing -eq 0 ]; then
        print_success "All health probes are configured"
        return 0
    else
        print_warn "$missing probe(s) are missing"
        return 1
    fi
}

# Check security context
check_security_context() {
    print_info "Checking security context..."
    
    if grep -q "securityContext:" base/deployment.yaml; then
        if grep -q "runAsNonRoot: true" base/deployment.yaml; then
            print_success "Security context is properly configured"
            return 0
        else
            print_warn "runAsNonRoot is not set to true"
            return 1
        fi
    else
        print_error "Security context is not configured"
        return 1
    fi
}

# Check HPA configuration
check_hpa() {
    print_info "Checking HorizontalPodAutoscaler..."
    
    if [ -f "base/hpa.yaml" ]; then
        if grep -q "minReplicas:" base/hpa.yaml && grep -q "maxReplicas:" base/hpa.yaml; then
            print_success "HPA is configured"
            return 0
        else
            print_error "HPA configuration is incomplete"
            return 1
        fi
    else
        print_error "HPA file not found"
        return 1
    fi
}

# Check PDB configuration
check_pdb() {
    print_info "Checking PodDisruptionBudget..."
    
    if [ -f "base/pdb.yaml" ]; then
        print_success "PDB is configured"
        return 0
    else
        print_warn "PDB file not found"
        return 1
    fi
}

# Check network policy
check_network_policy() {
    print_info "Checking NetworkPolicy..."
    
    if [ -f "base/networkpolicy.yaml" ]; then
        print_success "NetworkPolicy is configured"
        return 0
    else
        print_warn "NetworkPolicy file not found"
        return 1
    fi
}

# Check RBAC
check_rbac() {
    print_info "Checking RBAC configuration..."
    
    if [ -f "base/serviceaccount.yaml" ]; then
        if grep -q "ServiceAccount" base/serviceaccount.yaml && \
           grep -q "Role" base/serviceaccount.yaml && \
           grep -q "RoleBinding" base/serviceaccount.yaml; then
            print_success "RBAC is properly configured"
            return 0
        else
            print_error "RBAC configuration is incomplete"
            return 1
        fi
    else
        print_error "ServiceAccount file not found"
        return 1
    fi
}

# Main validation
main() {
    echo "=========================================="
    echo "Kubernetes Manifest Validation"
    echo "=========================================="
    echo
    
    local total_checks=0
    local passed_checks=0
    local failed_checks=0
    local warnings=0
    
    # Run all checks
    checks=(
        "check_kubectl"
        "validate_yaml_syntax"
        "check_secrets"
        "validate_kustomize"
        "check_resource_limits"
        "check_probes"
        "check_security_context"
        "check_hpa"
        "check_pdb"
        "check_network_policy"
        "check_rbac"
    )
    
    for check in "${checks[@]}"; do
        total_checks=$((total_checks + 1))
        echo
        if $check; then
            passed_checks=$((passed_checks + 1))
        else
            if [[ "$check" == "check_secrets" ]] || \
               [[ "$check" == "check_pdb" ]] || \
               [[ "$check" == "check_network_policy" ]]; then
                warnings=$((warnings + 1))
            else
                failed_checks=$((failed_checks + 1))
            fi
        fi
    done
    
    # Summary
    echo
    echo "=========================================="
    echo "Validation Summary"
    echo "=========================================="
    echo "Total checks: $total_checks"
    echo -e "${GREEN}Passed: $passed_checks${NC}"
    echo -e "${YELLOW}Warnings: $warnings${NC}"
    echo -e "${RED}Failed: $failed_checks${NC}"
    echo
    
    if [ $failed_checks -eq 0 ]; then
        print_success "Validation completed successfully!"
        if [ $warnings -gt 0 ]; then
            print_warn "Please review warnings before deploying to production"
        fi
        exit 0
    else
        print_error "Validation failed! Please fix errors before deploying"
        exit 1
    fi
}

# Run main function
main
