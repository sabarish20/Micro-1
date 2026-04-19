#!/bin/bash
# deploy.sh — Full observability stack on minikube
# Run from the observability-stack/ directory
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

print_header() { echo; echo "═══════════════════════════════════════════════"; echo "  $1"; echo "═══════════════════════════════════════════════"; }
print_step()   { echo; echo "─── $1 ───"; }

# ── 1. Minikube ───────────────────────────────────────────────────────────────
print_header "Starting Minikube"

if minikube status | grep -q "Running"; then
  echo "Minikube already running — skipping start."
else
  minikube start \
    --cpus=4 \
    --memory=8192 \
    --disk-size=40g \
    --driver=docker \
    --kubernetes-version=v1.29.0
fi

minikube addons enable metrics-server
minikube addons enable ingress

# ── 2. Helm repos ─────────────────────────────────────────────────────────────
print_step "Adding Helm repos"
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana               https://grafana.github.io/helm-charts
helm repo add fluent                https://fluent.github.io/helm-charts
helm repo add open-telemetry        https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update

# ── 3. Namespaces ─────────────────────────────────────────────────────────────
print_step "Creating namespaces"
for ns in monitoring logging tracing profiling; do
  kubectl create namespace "$ns" --dry-run=client -o yaml | kubectl apply -f -
done

# ── 4. Pillar 1: Metrics ──────────────────────────────────────────────────────
print_header "Installing kube-prometheus-stack (Metrics)"
helm upgrade --install kube-prom-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --values "$SCRIPT_DIR/helm-values/kube-prometheus-stack-values.yaml" \
  --wait --timeout=5m

# ── 5. Pillar 2: Logs ─────────────────────────────────────────────────────────
print_header "Installing Loki + Fluent Bit (Logs)"
helm upgrade --install loki grafana/loki \
  --namespace logging \
  --values "$SCRIPT_DIR/helm-values/loki-values.yaml" \
  --wait --timeout=3m

helm upgrade --install fluent-bit fluent/fluent-bit \
  --namespace logging \
  --values "$SCRIPT_DIR/helm-values/fluent-bit-values.yaml" \
  --wait --timeout=2m

# ── 6. Pillar 3: Traces ───────────────────────────────────────────────────────
print_header "Installing Tempo + OTel Collector (Traces)"
helm upgrade --install tempo grafana/tempo \
  --namespace tracing \
  --values "$SCRIPT_DIR/helm-values/tempo-values.yaml" \
  --wait --timeout=3m

helm upgrade --install otel-collector open-telemetry/opentelemetry-collector \
  --namespace tracing \
  --values "$SCRIPT_DIR/helm-values/otel-collector-values.yaml" \
  --wait --timeout=2m

# ── 7. Pillar 4: Profiles ─────────────────────────────────────────────────────
print_header "Installing Pyroscope (Profiles)"
helm upgrade --install pyroscope grafana/pyroscope \
  --namespace profiling \
  --values "$SCRIPT_DIR/helm-values/pyroscope-values.yaml" \
  --wait --timeout=3m

# ── 8. Grafana datasources ────────────────────────────────────────────────────
print_step "Applying Grafana datasources ConfigMap"
kubectl apply -f "$SCRIPT_DIR/grafana-datasources-configmap.yaml"

# Restart Grafana pod so it picks up new datasources
kubectl rollout restart deployment -n monitoring kube-prom-stack-grafana 2>/dev/null || true

# ── 9. Status ─────────────────────────────────────────────────────────────────
print_header "Deploy Complete — Stack Status"
echo
kubectl get pods -n monitoring
echo
kubectl get pods -n logging
echo
kubectl get pods -n tracing
echo
kubectl get pods -n profiling

# ── 10. Access instructions ───────────────────────────────────────────────────
GRAFANA_PASSWORD=$(kubectl get secret -n monitoring kube-prom-stack-grafana \
  -o jsonpath="{.data.admin-password}" 2>/dev/null | base64 --decode || echo "prom-operator")

print_header "Access Your Observability Stack"
cat <<EOF

  Run these port-forwards in separate terminals:

  # Grafana (all dashboards — metrics, logs, traces, profiles)
  kubectl port-forward -n monitoring svc/kube-prom-stack-grafana 3000:80
  → http://localhost:3000   Login: admin / ${GRAFANA_PASSWORD}

  # Prometheus (raw metrics + PromQL)
  kubectl port-forward -n monitoring svc/kube-prom-stack-prometheus 9090:9090
  → http://localhost:9090

  # AlertManager
  kubectl port-forward -n monitoring svc/kube-prom-stack-alertmanager 9093:9093
  → http://localhost:9093

  # Loki (log API)
  kubectl port-forward -n logging svc/loki 3100:3100
  → http://localhost:3100

  # Pyroscope (profiling UI)
  kubectl port-forward -n profiling svc/pyroscope 4040:4040
  → http://localhost:4040

  Quick test — fire a log and find it in Grafana:
  kubectl run test-log --image=busybox --restart=Never \\
    -- sh -c 'echo "{\"level\":\"error\",\"msg\":\"hello observability\",\"traceId\":\"abc123\"}"'

  Then in Grafana → Explore → Loki → query:
  {namespace="default"} | json | level="error"

EOF
