#!/bin/bash

# Enterprise Auth System - Kubernetes Deployment Script
# This script helps deploy the application to different environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed. Please install kubectl first."
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
        exit 1
    fi
    
    print_info "Prerequisites check passed!"
}

# Function to validate environment
validate_environment() {
    local env=$1
    if [[ ! "$env" =~ ^(development|staging|production)$ ]]; then
        print_error "Invalid environment: $env"
        echo "Valid environments: development, staging, production"
        exit 1
    fi
}

# Function to deploy
deploy() {
    local env=$1
    validate_environment "$env"
    
    print_info "Deploying to $env environment..."
    
    # Check if secrets are configured
    if grep -q "CHANGE_ME_IN_PRODUCTION" base/secret.yaml; then
        print_warn "Secrets contain placeholder values!"
        print_warn "Please update base/secret.yaml with actual credentials before deploying to production."
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Deployment cancelled."
            exit 0
        fi
    fi
    
    # Apply the configuration
    kubectl apply -k "overlays/$env/"
    
    print_info "Deployment initiated!"
    print_info "Checking rollout status..."
    
    # Get namespace based on environment
    local namespace="enterprise-auth"
    case $env in
        production)
            namespace="enterprise-auth-prod"
            ;;
        staging)
            namespace="enterprise-auth-staging"
            ;;
        development)
            namespace="enterprise-auth-dev"
            ;;
    esac
    
    # Wait for rollout
    kubectl rollout status deployment/enterprise-auth -n "$namespace" --timeout=5m
    
    print_info "Deployment completed successfully!"
    print_info "Checking pod status..."
    kubectl get pods -n "$namespace" -l app=enterprise-auth
}

# Function to delete deployment
delete() {
    local env=$1
    validate_environment "$env"
    
    print_warn "This will delete the $env deployment!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Deletion cancelled."
        exit 0
    fi
    
    print_info "Deleting $env deployment..."
    kubectl delete -k "overlays/$env/"
    print_info "Deployment deleted!"
}

# Function to show status
status() {
    local env=$1
    validate_environment "$env"
    
    local namespace="enterprise-auth"
    case $env in
        production)
            namespace="enterprise-auth-prod"
            ;;
        staging)
            namespace="enterprise-auth-staging"
            ;;
        development)
            namespace="enterprise-auth-dev"
            ;;
    esac
    
    print_info "Status for $env environment (namespace: $namespace):"
    echo
    
    print_info "Pods:"
    kubectl get pods -n "$namespace" -l app=enterprise-auth
    echo
    
    print_info "Services:"
    kubectl get svc -n "$namespace"
    echo
    
    print_info "HPA:"
    kubectl get hpa -n "$namespace"
    echo
    
    print_info "Ingress:"
    kubectl get ingress -n "$namespace"
}

# Function to show logs
logs() {
    local env=$1
    validate_environment "$env"
    
    local namespace="enterprise-auth"
    case $env in
        production)
            namespace="enterprise-auth-prod"
            ;;
        staging)
            namespace="enterprise-auth-staging"
            ;;
        development)
            namespace="enterprise-auth-dev"
            ;;
    esac
    
    print_info "Showing logs for $env environment..."
    kubectl logs -n "$namespace" -l app=enterprise-auth --tail=100 -f
}

# Function to scale deployment
scale() {
    local env=$1
    local replicas=$2
    validate_environment "$env"
    
    if ! [[ "$replicas" =~ ^[0-9]+$ ]]; then
        print_error "Invalid replica count: $replicas"
        exit 1
    fi
    
    local namespace="enterprise-auth"
    case $env in
        production)
            namespace="enterprise-auth-prod"
            ;;
        staging)
            namespace="enterprise-auth-staging"
            ;;
        development)
            namespace="enterprise-auth-dev"
            ;;
    esac
    
    print_info "Scaling $env deployment to $replicas replicas..."
    kubectl scale deployment/enterprise-auth -n "$namespace" --replicas="$replicas"
    print_info "Scaled successfully!"
}

# Function to restart deployment
restart() {
    local env=$1
    validate_environment "$env"
    
    local namespace="enterprise-auth"
    case $env in
        production)
            namespace="enterprise-auth-prod"
            ;;
        staging)
            namespace="enterprise-auth-staging"
            ;;
        development)
            namespace="enterprise-auth-dev"
            ;;
    esac
    
    print_info "Restarting $env deployment..."
    kubectl rollout restart deployment/enterprise-auth -n "$namespace"
    kubectl rollout status deployment/enterprise-auth -n "$namespace"
    print_info "Restart completed!"
}

# Function to show help
show_help() {
    cat << EOF
Enterprise Auth System - Kubernetes Deployment Script

Usage: $0 <command> <environment> [options]

Commands:
    deploy <env>              Deploy to specified environment
    delete <env>              Delete deployment from environment
    status <env>              Show deployment status
    logs <env>                Show logs (follows)
    scale <env> <replicas>    Scale deployment to specified replicas
    restart <env>             Restart deployment (rolling restart)
    help                      Show this help message

Environments:
    development               Development environment
    staging                   Staging environment
    production                Production environment

Examples:
    $0 deploy production
    $0 status staging
    $0 logs development
    $0 scale production 10
    $0 restart staging

EOF
}

# Main script logic
main() {
    check_prerequisites
    
    local command=$1
    local env=$2
    
    case $command in
        deploy)
            if [ -z "$env" ]; then
                print_error "Environment not specified"
                show_help
                exit 1
            fi
            deploy "$env"
            ;;
        delete)
            if [ -z "$env" ]; then
                print_error "Environment not specified"
                show_help
                exit 1
            fi
            delete "$env"
            ;;
        status)
            if [ -z "$env" ]; then
                print_error "Environment not specified"
                show_help
                exit 1
            fi
            status "$env"
            ;;
        logs)
            if [ -z "$env" ]; then
                print_error "Environment not specified"
                show_help
                exit 1
            fi
            logs "$env"
            ;;
        scale)
            if [ -z "$env" ]; then
                print_error "Environment not specified"
                show_help
                exit 1
            fi
            local replicas=$3
            if [ -z "$replicas" ]; then
                print_error "Replica count not specified"
                show_help
                exit 1
            fi
            scale "$env" "$replicas"
            ;;
        restart)
            if [ -z "$env" ]; then
                print_error "Environment not specified"
                show_help
                exit 1
            fi
            restart "$env"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
