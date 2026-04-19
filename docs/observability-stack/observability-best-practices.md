# Complete Observability Stack — Industry Best Practices
### Metrics · Logs · Traces · Profiles on Kubernetes (Minikube)

---

## Table of Contents

1. [The Four Pillars of Observability](#1-the-four-pillars-of-observability)
2. [Industry Mental Models](#2-industry-mental-models)
3. [Tool Landscape — What to Use and Why](#3-tool-landscape--what-to-use-and-why)
4. [The Stack We Will Build](#4-the-stack-we-will-build)
5. [Minikube Prerequisites](#5-minikube-prerequisites)
6. [Pillar 1 — Metrics: kube-prometheus-stack](#6-pillar-1--metrics-kube-prometheus-stack)
7. [Pillar 2 — Logs: Fluent Bit + Loki](#7-pillar-2--logs-fluent-bit--loki)
8. [Pillar 3 — Traces: OpenTelemetry + Tempo](#8-pillar-3--traces-opentelemetry--tempo)
9. [Pillar 4 — Profiles: Pyroscope](#9-pillar-4--profiles-pyroscope)
10. [Grafana — Unified View of All Pillars](#10-grafana--unified-view-of-all-pillars)
11. [Signal Correlation — Connecting the Pillars](#11-signal-correlation--connecting-the-pillars)
12. [Alerting Best Practices](#12-alerting-best-practices)
13. [Full Deploy Script](#13-full-deploy-script)
14. [Instrumenting Your Applications](#14-instrumenting-your-applications)
15. [Production Upgrade Paths](#15-production-upgrade-paths)

---

## 1. The Four Pillars of Observability

Observability answers the question: **"What is my system doing right now and why?"**

The industry has converged on four complementary signals. No single one is enough on its own.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     THE FOUR PILLARS                                      │
│                                                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐   │
│  │   METRICS   │  │    LOGS     │  │   TRACES    │  │   PROFILES   │   │
│  │             │  │             │  │             │  │              │   │
│  │ Numbers     │  │ Events      │  │ Request     │  │ CPU/Memory   │   │
│  │ over time   │  │ with        │  │ journeys    │  │ usage per    │   │
│  │             │  │ context     │  │ across      │  │ function     │   │
│  │ "How much?" │  │ "What       │  │ services    │  │              │   │
│  │ "How fast?" │  │  happened?" │  │ "Why slow?" │  │ "Where is    │   │
│  │             │  │             │  │             │  │  CPU going?" │   │
│  │ Prometheus  │  │ Loki        │  │ Tempo       │  │ Pyroscope    │   │
│  │ Victoria    │  │ Fluent Bit  │  │ OTel        │  │              │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────────┘   │
│                                                                            │
│                    Visualized & Alerted on via GRAFANA                    │
└──────────────────────────────────────────────────────────────────────────┘
```

| Pillar | Answers | Granularity | Cost |
|--------|---------|-------------|------|
| **Metrics** | Is the system healthy? What are the trends? | Aggregated (numbers) | Low |
| **Logs** | What happened exactly? What was the context? | Per-event (text) | Medium |
| **Traces** | Which service caused this slowdown? | Per-request (spans) | Medium |
| **Profiles** | Which line of code is consuming CPU/memory? | Per-function (flamegraph) | Low |

---

## 2. Industry Mental Models

These are the frameworks that SRE teams at Google, Netflix, and Cloudflare use to know what to measure.

### The RED Method (for services/APIs)

Apply to every service you build:

```
R — Rate      How many requests per second is this service handling?
E — Errors    What fraction of those requests are failing?
D — Duration  How long does each request take? (p50, p95, p99)
```

**Prometheus example:**

```promql
# Rate: requests per second
rate(http_requests_total{service="payments"}[5m])

# Errors: percentage of 5xx responses
rate(http_requests_total{service="payments", status=~"5.."}[5m])
/ rate(http_requests_total{service="payments"}[5m]) * 100

# Duration: 99th percentile latency
histogram_quantile(0.99,
  rate(http_request_duration_seconds_bucket{service="payments"}[5m])
)
```

### The USE Method (for infrastructure/resources)

Apply to every node, disk, network interface, and CPU:

```
U — Utilization   What % of capacity is being used?
S — Saturation    Is the resource queuing work (overloaded)?
E — Errors        Is the resource reporting errors?
```

### The Four Golden Signals (Google SRE)

A superset combining both methods:

```
1. Latency   — How long does it take to serve a request?
2. Traffic   — How much demand is on the system?
3. Errors    — What is the rate of failed requests?
4. Saturation — How full is the service? (CPU, memory, queue depth)
```

> **Rule of thumb:** Start with RED for every microservice. Then add USE for your nodes. The 4 Golden Signals give you a complete picture.

---

## 3. Tool Landscape — What to Use and Why

### Metrics

| Tool | Use Case | Notes |
|------|---------|-------|
| **Prometheus** | Standard, pull-based metrics | Industry default, huge ecosystem of exporters |
| **VictoriaMetrics** | Drop-in Prometheus replacement | 10x more efficient storage, better for high-cardinality |
| **Thanos / Cortex** | Long-term Prometheus storage | Multi-cluster, unlimited retention |
| **kube-state-metrics** | K8s object metrics (pods, deployments) | Bundled with kube-prometheus-stack |
| **node-exporter** | Host-level metrics (CPU, disk, memory) | Bundled with kube-prometheus-stack |

**Recommendation:** Start with **Prometheus** (kube-prometheus-stack). Switch to **VictoriaMetrics** when you have >1M time series or need >30 days retention cheaply.

### Logs

| Tool | Role | Notes |
|------|------|-------|
| **Fluent Bit** | Collector / shipper | Lightweight, runs as DaemonSet |
| **Fluentd** | Heavy-duty collector | More plugins, higher resource usage |
| **Loki** | Log storage | Index labels only — cheap, fast |
| **Elasticsearch** | Full-text indexed log storage | Powerful but expensive and complex |
| **OpenSearch** | Open-source Elasticsearch fork | Community alternative |

**Recommendation:** **Fluent Bit + Loki** for Kubernetes-native log pipelines. Use Elasticsearch only when you need full-text search on log bodies at scale.

### Traces

| Tool | Role | Notes |
|------|------|-------|
| **OpenTelemetry SDK** | Instrumentation (app-side) | Vendor-neutral standard — use this in every app |
| **OTel Collector** | Pipeline / routing hub | Receives, processes, exports any signal |
| **Grafana Tempo** | Trace storage | Stores by trace ID, scales cheaply, integrates with Grafana |
| **Jaeger** | Trace storage + UI | Older standard, good standalone UI |
| **Zipkin** | Trace storage + UI | Lightweight, older, less maintained |

**Recommendation:** Instrument with **OpenTelemetry SDK** (never vendor SDK). Store in **Tempo** (cheapest, integrates with Grafana). Use OTel Collector in the middle for routing flexibility.

### Profiles

| Tool | Role | Notes |
|------|------|-------|
| **Pyroscope** | Continuous profiling server | Now part of Grafana stack, integrates natively |
| **Parca** | Open-source continuous profiling | CNCF project, uses eBPF |
| **Pyroscope eBPF agent** | Zero-instrumentation profiling | Profiles any language without code changes |

**Recommendation:** **Pyroscope** — it integrates directly with Grafana, supports Go/Java/Python/Node, and has an eBPF agent for zero-code profiling.

### Visualization & Alerting

| Tool | Role |
|------|------|
| **Grafana** | Unified dashboards across all four pillars |
| **AlertManager** | Routes Prometheus alerts to Slack/PagerDuty/email |
| **Grafana Alerting** | Unified alerting across metrics, logs, and traces |

---

## 4. The Stack We Will Build

```
┌────────────────────────────────────────────────────────────────────────┐
│                         Minikube Cluster                                │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │   Your Apps  │  │   Your Apps  │  │   Your Apps  │                 │
│  │  (instrumented with OTel SDK)  │                  │                 │
│  └──┬───┬───┬───┘  └──────────────┘  └──────────────┘                 │
│     │   │   │                                                           │
│   logs metrics traces+profiles                                          │
│     │   │   │                                                           │
│  ┌──▼───▼───▼────────────────────────────────────────────────────┐    │
│  │                    COLLECTION LAYER                             │    │
│  │  ┌─────────────┐  ┌────────────────────┐  ┌────────────────┐  │    │
│  │  │ Fluent Bit  │  │  Prometheus        │  │  OTel          │  │    │
│  │  │ (DaemonSet) │  │  (scrapes /metrics)│  │  Collector     │  │    │
│  │  └──────┬──────┘  └────────┬───────────┘  └───────┬────────┘  │    │
│  └─────────┼──────────────────┼─────────────────────┼────────────┘    │
│            │                  │                       │                 │
│  ┌─────────▼──────────────────▼─────────────────────▼────────────┐    │
│  │                    STORAGE LAYER                                │    │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────┐  │    │
│  │  │   Loki   │  │  Prometheus  │  │  Tempo   │  │Pyroscope │  │    │
│  │  │  (logs)  │  │  (metrics)   │  │ (traces) │  │(profiles)│  │    │
│  │  └──────┬───┘  └──────┬───────┘  └────┬─────┘  └────┬─────┘  │    │
│  └─────────┼─────────────┼───────────────┼──────────────┼─────────┘    │
│            └─────────────┴───────────────┴──────────────┘              │
│                                    │                                     │
│                          ┌─────────▼──────────┐                        │
│                          │      GRAFANA        │                        │
│                          │  (unified UI for    │                        │
│                          │   all 4 pillars)    │                        │
│                          └─────────────────────┘                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Minikube Prerequisites

```bash
# Start minikube with enough resources for the full stack
minikube start \
  --cpus=4 \
  --memory=8192 \
  --disk-size=40g \
  --driver=docker \
  --kubernetes-version=v1.29.0

# Enable required addons
minikube addons enable metrics-server   # for kubectl top
minikube addons enable ingress          # for web UI access

# Verify
kubectl get nodes
minikube status

# Add all Helm repos upfront
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana               https://grafana.github.io/helm-charts
helm repo add fluent                https://fluent.github.io/helm-charts
helm repo add open-telemetry        https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update

# Create namespaces
kubectl create namespace monitoring
kubectl create namespace logging
kubectl create namespace tracing
kubectl create namespace profiling
```

---

## 6. Pillar 1 — Metrics: kube-prometheus-stack

`kube-prometheus-stack` is a single Helm chart that installs:
- **Prometheus** — scrapes metrics from all pods and nodes
- **AlertManager** — routes alerts to Slack, PagerDuty, email
- **Grafana** — pre-loaded with 30+ Kubernetes dashboards
- **node-exporter** — host-level CPU/memory/disk/network metrics
- **kube-state-metrics** — Kubernetes object metrics (pod restarts, deployment status)
- **Prometheus Operator** — manages Prometheus config via Kubernetes CRDs

### What metrics you get out of the box

```
Node level:       CPU %, memory %, disk I/O, network in/out
Kubernetes:       Pod restart count, deployment replicas, PVC usage
Container:        CPU throttling, OOM kills, container restarts
API Server:       Request rate, latency, error rate
etcd:             Latency, leader changes, database size
CoreDNS:          Query rate, cache hits, error rate
```

### Install

```bash
helm install kube-prom-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --values helm-values/kube-prometheus-stack-values.yaml \
  --wait
```

### Key CRDs to know

```yaml
# ServiceMonitor — tells Prometheus to scrape your app's /metrics endpoint
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app-metrics
  namespace: monitoring
  labels:
    release: kube-prom-stack   # must match Prometheus's serviceMonitorSelector
spec:
  selector:
    matchLabels:
      app: my-app              # selects Services with this label
  endpoints:
    - port: http               # port name from the Service spec
      path: /metrics
      interval: 15s
```

```yaml
# PrometheusRule — define alerting rules as Kubernetes objects
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: my-app-alerts
  namespace: monitoring
  labels:
    release: kube-prom-stack
spec:
  groups:
    - name: my-app
      rules:
        - alert: HighErrorRate
          expr: |
            rate(http_requests_total{status=~"5..", app="my-app"}[5m])
            / rate(http_requests_total{app="my-app"}[5m]) > 0.05
          for: 2m
          labels:
            severity: critical
          annotations:
            summary: "Error rate above 5% for {{ $labels.app }}"
```

### Essential PromQL queries

```promql
# ── Node health ───────────────────────────────────────────────────────────────
# CPU usage per node
100 - (avg by(node) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory usage %
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100

# Disk usage %
(1 - node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100

# ── Pod health ────────────────────────────────────────────────────────────────
# Pods not running
kube_pod_status_phase{phase!="Running", phase!="Succeeded"}

# Container restart count (last hour)
increase(kube_pod_container_status_restarts_total[1h]) > 0

# OOM killed containers
kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}

# ── Service RED metrics ───────────────────────────────────────────────────────
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# p99 latency
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
```

---

## 7. Pillar 2 — Logs: Fluent Bit + Loki

> Full configuration reference is in `../observability-tutorial.md`.

### Quick deploy for minikube

```bash
helm install loki grafana/loki \
  --namespace logging \
  --values helm-values/loki-values.yaml \
  --wait

helm install fluent-bit fluent/fluent-bit \
  --namespace logging \
  --values helm-values/fluent-bit-values.yaml \
  --wait
```

### Log best practices

**1. Structure your logs as JSON**

```json
{
  "timestamp": "2024-04-01T10:00:00.000Z",
  "level": "error",
  "service": "payments",
  "traceId": "abc123def456",
  "spanId":  "789xyz",
  "userId":  "user_42",
  "msg":     "Payment declined",
  "amount":  99.99,
  "currency":"USD"
}
```

**2. Always include `traceId` in logs** — this is what lets you jump from a log line directly to the trace in Grafana.

**3. Use log levels consistently**

```
DEBUG   — developer detail, disabled in production
INFO    — normal operational events
WARN    — something unexpected but handled
ERROR   — something failed, needs attention
FATAL   — process is about to crash
```

**4. Never log secrets, PII, or tokens**

**5. Loki label cardinality rule:** Labels = `namespace`, `app`, `env`, `level`. Everything else goes in the log body.

---

## 8. Pillar 3 — Traces: OpenTelemetry + Tempo

Distributed tracing answers: **"For this specific request that took 3 seconds, which service was slow and why?"**

### How tracing works

```
User Request
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│  Trace ID: abc123                                            │
│                                                               │
│  [API Gateway        ] ████████████████████ 450ms           │
│     [Auth Service    ]    ██████ 120ms                       │
│     [Payments Service]          ███████████ 300ms           │
│        [DB Query     ]            ████ 80ms                  │
│        [Cache Miss   ]                ██ 40ms                │
└──────────────────────────────────────────────────────────────┘

Each colored bar = a SPAN
The whole thing = a TRACE
```

### OpenTelemetry — the instrumentation standard

OpenTelemetry (OTel) is the **CNCF standard** for emitting traces, metrics, and logs from your code. It is vendor-neutral — you write once, route anywhere.

**Never use a vendor-specific SDK** (Jaeger client, Zipkin client). Always use OpenTelemetry.

### Install OTel Collector + Tempo

```bash
# Tempo (trace storage)
helm install tempo grafana/tempo \
  --namespace tracing \
  --values helm-values/tempo-values.yaml \
  --wait

# OTel Collector (receives traces from apps, forwards to Tempo)
helm install otel-collector open-telemetry/opentelemetry-collector \
  --namespace tracing \
  --values helm-values/otel-collector-values.yaml \
  --wait
```

### Instrument your app (Go example)

```go
package main

import (
    "context"
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
    "go.opentelemetry.io/otel/sdk/trace"
    "go.opentelemetry.io/otel/sdk/resource"
    semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
)

func initTracer() func(context.Context) error {
    exporter, _ := otlptracehttp.New(context.Background(),
        otlptracehttp.WithEndpoint("otel-collector.tracing.svc.cluster.local:4318"),
        otlptracehttp.WithInsecure(),
    )

    tp := trace.NewTracerProvider(
        trace.WithBatcher(exporter),
        trace.WithResource(resource.NewWithAttributes(
            semconv.SchemaURL,
            semconv.ServiceName("payments-service"),
            semconv.ServiceVersion("v1.0.0"),
        )),
    )
    otel.SetTracerProvider(tp)
    return tp.Shutdown
}

// In your HTTP handler:
func handlePayment(w http.ResponseWriter, r *http.Request) {
    ctx, span := otel.Tracer("payments").Start(r.Context(), "process-payment")
    defer span.End()

    span.SetAttributes(
        attribute.String("payment.method", "card"),
        attribute.Float64("payment.amount", 99.99),
    )
    // ... your logic
}
```

### Instrument your app (Node.js example)

```javascript
// tracing.js — load this before anything else
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://otel-collector.tracing.svc.cluster.local:4318/v1/traces',
  }),
  instrumentations: [
    // Automatically instruments: HTTP, Express, gRPC, DB drivers, Redis, etc.
    getNodeAutoInstrumentations(),
  ],
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'order-service',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  }),
});
sdk.start();
```

### Instrument your app (Python example)

```python
# tracing.py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor

def init_tracing(app):
    provider = TracerProvider(
        resource=Resource.create({"service.name": "user-service"})
    )
    provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(
            endpoint="http://otel-collector.tracing.svc.cluster.local:4318/v1/traces"
        ))
    )
    trace.set_tracer_provider(provider)

    # Auto-instruments all FastAPI routes
    FastAPIInstrumentor.instrument_app(app)
    # Auto-instruments all outgoing HTTP calls
    RequestsInstrumentor().instrument()
```

### Tracing best practices

- **Auto-instrument first** — OTel has auto-instrumentation libraries for HTTP, gRPC, databases, message queues. Use them before adding manual spans.
- **Add business context to spans** — `span.SetAttributes(payment.amount, user.id, order.id)` — these appear in the trace UI.
- **Propagate context across service boundaries** — OTel does this automatically for HTTP (via `traceparent` header) and gRPC.
- **Always include `traceId` in log lines** — enables jumping from log to trace in Grafana.
- **Sample intelligently** — in high-traffic production, trace 100% of errors and ~5% of successes.

---

## 9. Pillar 4 — Profiles: Pyroscope

Continuous profiling answers: **"My service is using 90% CPU — which exact function is responsible?"**

Unlike traditional profiling (which you run manually), **continuous profiling** runs 24/7 at low overhead and stores profiles over time so you can compare "before deploy" vs "after deploy".

### Two modes

| Mode | How | When to use |
|------|-----|-------------|
| **eBPF agent** | DaemonSet, zero code changes, works for any language | Infrastructure-level profiling, quick wins |
| **SDK profiling** | Add library to your app | More detail, can see your custom function names |

### Install Pyroscope

```bash
helm install pyroscope grafana/pyroscope \
  --namespace profiling \
  --values helm-values/pyroscope-values.yaml \
  --wait
```

### Add SDK profiling (Go)

```go
import "github.com/grafana/pyroscope-go"

func main() {
    pyroscope.Start(pyroscope.Config{
        ApplicationName: "payments.service",
        ServerAddress:   "http://pyroscope.profiling.svc.cluster.local:4040",
        ProfileTypes: []pyroscope.ProfileType{
            pyroscope.ProfileCPU,
            pyroscope.ProfileAllocObjects,
            pyroscope.ProfileAllocSpace,
            pyroscope.ProfileInuseObjects,
            pyroscope.ProfileInuseSpace,
        },
        Tags: map[string]string{
            "env":     "production",
            "version": os.Getenv("APP_VERSION"),
        },
    })
}
```

### Add SDK profiling (Python)

```python
import pyroscope

pyroscope.configure(
    application_name="user-service",
    server_address="http://pyroscope.profiling.svc.cluster.local:4040",
    tags={"env": "production"},
)
```

### Add SDK profiling (Node.js)

```javascript
const Pyroscope = require('@pyroscope/nodejs');

Pyroscope.init({
  serverAddress: 'http://pyroscope.profiling.svc.cluster.local:4040',
  appName: 'order-service',
  tags: { env: 'production' },
});
Pyroscope.start();
```

---

## 10. Grafana — Unified View of All Pillars

Grafana connects to all four storage backends as **datasources** and lets you correlate signals in a single UI.

### Datasource layout

```
Grafana
  ├── Datasource: Prometheus  →  metrics queries (PromQL)
  ├── Datasource: Loki        →  log queries (LogQL)
  ├── Datasource: Tempo       →  trace queries (TraceQL)
  └── Datasource: Pyroscope   →  profiling queries (FlameQL)
```

### Provision all datasources automatically

```yaml
# grafana-datasources-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-datasources
  namespace: monitoring
  labels:
    grafana_datasource: "1"
data:
  datasources.yaml: |
    apiVersion: 1
    datasources:

      - name: Prometheus
        type: prometheus
        uid: prometheus
        url: http://kube-prom-stack-prometheus.monitoring.svc.cluster.local:9090
        isDefault: true
        jsonData:
          exemplarTraceIdDestinations:
            # Link exemplars in metrics to traces in Tempo
            - name: traceID
              datasourceUid: tempo

      - name: Loki
        type: loki
        uid: loki
        url: http://loki.logging.svc.cluster.local:3100
        jsonData:
          maxLines: 5000
          derivedFields:
            # Turn traceId fields in log lines into clickable links to Tempo
            - name: TraceID
              matcherRegex: '"traceId":"(\w+)"'
              url: '$${__value.raw}'
              datasourceUid: tempo

      - name: Tempo
        type: tempo
        uid: tempo
        url: http://tempo.tracing.svc.cluster.local:3100
        jsonData:
          tracesToLogsV2:
            datasourceUid: loki
            filterByTraceID: true
            filterBySpanID: false
          tracesToMetrics:
            datasourceUid: prometheus
            queries:
              - name: "Request rate"
                query: "rate(http_requests_total{service=\"$${__span.tags.service}\"}[5m])"
          serviceMap:
            datasourceUid: prometheus
          nodeGraph:
            enabled: true

      - name: Pyroscope
        type: grafana-pyroscope-datasource
        uid: pyroscope
        url: http://pyroscope.profiling.svc.cluster.local:4040
```

### Key Grafana dashboards to import

| Dashboard ID | Name | Covers |
|-------------|------|--------|
| `315` | Kubernetes cluster monitoring | All K8s nodes and pods |
| `13332` | Kubernetes pods | Per-pod CPU/memory |
| `12019` | Node Exporter Full | Detailed node metrics |
| `10956` | Loki Dashboard | Log volume and rates |
| `17781` | Tempo / Tracing | Trace latency and rates |
| `14930` | Kubernetes Namespace | Per-namespace resource usage |

Import them via: **Grafana → Dashboards → Import → Enter Dashboard ID**

---

## 11. Signal Correlation — Connecting the Pillars

The real power of this stack is **jumping between signals** in Grafana without leaving the UI.

### Metrics → Traces (via Exemplars)

Prometheus supports **exemplars** — embedding a `traceId` directly in a metric data point.

```go
// In your Go HTTP handler, attach the trace ID to the histogram observation
histogram.With(prometheus.Labels{"route": "/api/payment"}).
    ObserveWithExemplar(duration.Seconds(), prometheus.Labels{
        "traceID": span.SpanContext().TraceID().String(),
    })
```

In Grafana, click any spike on a metrics graph → **"Show Exemplars"** → click an exemplar → jumps to the trace.

### Logs → Traces (via traceId field)

```json
// When your app logs include traceId:
{"level":"error","msg":"DB timeout","traceId":"abc123def456","spanId":"789xyz"}
```

In Grafana Loki explore, clicking the `traceId` value opens the trace in Tempo automatically (configured via `derivedFields` in the datasource).

### Traces → Logs (via Tempo)

In the Tempo trace view, there is a **"Logs"** button on each span that runs a Loki query filtered to that trace ID and time window.

### Traces → Profiles (via Pyroscope)

In the Tempo trace view, there is a **"Profile"** button that opens the Pyroscope flamegraph for the service at the exact time window of the span.

### The correlation flow

```
Alert fires: "p99 latency spike at 14:32"
         │
         ▼  (click exemplar on the metrics graph)
Trace: shows DB query took 2.8s at 14:32
         │
         ▼  (click Logs button on the slow span)
Logs: "connection pool exhausted — 47 waiting"
         │
         ▼  (click Profile button)
Flamegraph: getConnection() taking 91% of CPU
         │
         ▼
Fix: increase DB connection pool size
```

---

## 12. Alerting Best Practices

### AlertManager for Prometheus alerts

```yaml
# alertmanager-config.yaml
global:
  slack_api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK'

route:
  group_by: ['alertname', 'namespace']
  group_wait: 30s        # wait 30s to group related alerts
  group_interval: 5m     # wait 5m before sending updated alert
  repeat_interval: 4h    # resend if still firing after 4h
  receiver: 'slack-warnings'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
      continue: true   # also send to default receiver

receivers:
  - name: 'slack-warnings'
    slack_configs:
      - channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'

  - name: 'pagerduty-critical'
    pagerduty_configs:
      - routing_key: 'YOUR_PAGERDUTY_KEY'
```

### Alert writing rules

```yaml
# Bad alert — too noisy, fires on any blip
- alert: HighLatency
  expr: http_request_duration_seconds > 1

# Good alert — fires only when sustained, with context
- alert: HighLatency
  expr: |
    histogram_quantile(0.99,
      rate(http_request_duration_seconds_bucket[5m])
    ) > 1
  for: 5m                                          # must be true for 5 minutes
  labels:
    severity: warning
  annotations:
    summary: "p99 latency > 1s for {{ $labels.service }}"
    description: "Current value: {{ $value | humanizeDuration }}"
    runbook_url: "https://wiki.company.com/runbooks/high-latency"
```

### The most important alerts to have

```yaml
# 1. Pod crash-looping
- alert: PodCrashLooping
  expr: increase(kube_pod_container_status_restarts_total[15m]) > 3

# 2. Pod not ready
- alert: PodNotReady
  expr: kube_pod_status_ready{condition="false"} == 1
  for: 5m

# 3. High CPU throttling
- alert: CPUThrottling
  expr: |
    rate(container_cpu_cfs_throttled_seconds_total[5m])
    / rate(container_cpu_cfs_periods_total[5m]) > 0.5
  for: 10m

# 4. PVC almost full
- alert: PersistentVolumeAlmostFull
  expr: |
    kubelet_volume_stats_available_bytes
    / kubelet_volume_stats_capacity_bytes < 0.1
  for: 5m

# 5. Node not ready
- alert: NodeNotReady
  expr: kube_node_status_condition{condition="Ready", status="true"} == 0
  for: 2m
```

---

## 13. Full Deploy Script

Run this end-to-end to get the complete stack running on minikube:

```bash
#!/bin/bash
set -euo pipefail

echo "═══════════════════════════════════════════════"
echo " Starting Minikube with observability resources"
echo "═══════════════════════════════════════════════"

minikube start \
  --cpus=4 \
  --memory=8192 \
  --disk-size=40g \
  --driver=docker \
  --kubernetes-version=v1.29.0

minikube addons enable metrics-server
minikube addons enable ingress

echo "─── Adding Helm repos ───────────────────────────"
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana               https://grafana.github.io/helm-charts
helm repo add fluent                https://fluent.github.io/helm-charts
helm repo add open-telemetry        https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update

echo "─── Creating namespaces ────────────────────────"
kubectl create namespace monitoring  --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace logging     --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace tracing     --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace profiling   --dry-run=client -o yaml | kubectl apply -f -

echo "─── [1/5] Installing kube-prometheus-stack ─────"
helm upgrade --install kube-prom-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --values helm-values/kube-prometheus-stack-values.yaml \
  --wait --timeout=5m

echo "─── [2/5] Installing Loki ───────────────────────"
helm upgrade --install loki grafana/loki \
  --namespace logging \
  --values helm-values/loki-values.yaml \
  --wait --timeout=3m

echo "─── [3/5] Installing Fluent Bit ─────────────────"
helm upgrade --install fluent-bit fluent/fluent-bit \
  --namespace logging \
  --values helm-values/fluent-bit-values.yaml \
  --wait --timeout=2m

echo "─── [4/5] Installing Tempo + OTel Collector ─────"
helm upgrade --install tempo grafana/tempo \
  --namespace tracing \
  --values helm-values/tempo-values.yaml \
  --wait --timeout=3m

helm upgrade --install otel-collector open-telemetry/opentelemetry-collector \
  --namespace tracing \
  --values helm-values/otel-collector-values.yaml \
  --wait --timeout=2m

echo "─── [5/5] Installing Pyroscope ──────────────────"
helm upgrade --install pyroscope grafana/pyroscope \
  --namespace profiling \
  --values helm-values/pyroscope-values.yaml \
  --wait --timeout=3m

echo "─── Applying Grafana datasources ────────────────"
kubectl apply -f grafana-datasources-configmap.yaml

echo "═══════════════════════════════════════════════"
echo " Stack deployed! Access Grafana:"
echo "   kubectl port-forward -n monitoring svc/kube-prom-stack-grafana 3000:80"
echo "   Open: http://localhost:3000  (admin / prom-operator)"
echo "═══════════════════════════════════════════════"

kubectl get pods -A | grep -E "monitoring|logging|tracing|profiling"
```

---

## 14. Instrumenting Your Applications

### What to expose from every microservice

```
/metrics   — Prometheus metrics endpoint (required)
/healthz   — liveness probe
/readyz    — readiness probe
```

### Minimal Kubernetes deployment with full observability annotations

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments-service
  namespace: production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: payments-service
  template:
    metadata:
      labels:
        app: payments-service
        version: "1.0.0"
      annotations:
        # Prometheus scraping (if not using ServiceMonitor CRD)
        prometheus.io/scrape: "true"
        prometheus.io/port:   "8080"
        prometheus.io/path:   "/metrics"
        # Fluent Bit log parsing
        fluentbit.io/parser: "json_app"
    spec:
      containers:
        - name: payments
          image: your-registry/payments-service:1.0.0
          ports:
            - name: http
              containerPort: 8080
          env:
            # OTel auto-configuration via environment variables
            - name: OTEL_EXPORTER_OTLP_ENDPOINT
              value: "http://otel-collector.tracing.svc.cluster.local:4318"
            - name: OTEL_SERVICE_NAME
              value: "payments-service"
            - name: OTEL_RESOURCE_ATTRIBUTES
              value: "deployment.environment=production,service.version=1.0.0"
            - name: OTEL_TRACES_SAMPLER
              value: "parentbased_traceidratio"
            - name: OTEL_TRACES_SAMPLER_ARG
              value: "0.1"   # sample 10% of traces in production
          resources:
            requests:
              cpu:    "100m"
              memory: "128Mi"
            limits:
              cpu:    "500m"
              memory: "512Mi"
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /readyz
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
```

---

## 15. Production Upgrade Paths

Once you outgrow single-node minikube deployments:

### Metrics at scale

| Situation | Solution |
|-----------|---------|
| >1M active time series | Switch to **VictoriaMetrics** (drop-in Prometheus replacement) |
| Multi-cluster | Add **Thanos** (sidecar + query layer) or **Grafana Mimir** |
| >90 days retention | Use VictoriaMetrics or Thanos with S3/GCS backend |

### Logs at scale

| Situation | Solution |
|-----------|---------|
| >TB/day log volume | Loki with S3 backend (`object_store: s3`) |
| Full-text search required | Add **Elasticsearch** / **OpenSearch** as a second output |
| Multi-region | Loki in microservices mode with distributed components |

### Traces at scale

| Situation | Solution |
|-----------|---------|
| High trace volume | Add **tail-based sampling** in OTel Collector (keep 100% of errors, 5% of successes) |
| Long retention | Tempo with S3 backend |
| Complex sampling rules | Use **OpenTelemetry Collector** sampling processor |

### Profiles at scale

Pyroscope scales horizontally — just increase replicas and add an object store backend (S3).

---

## Quick Reference — Service Endpoints in Minikube

```bash
# Access everything via port-forward while learning locally

# Grafana (all dashboards)
kubectl port-forward -n monitoring svc/kube-prom-stack-grafana 3000:80
# → http://localhost:3000  (admin / prom-operator)

# Prometheus (raw metrics, query, alert status)
kubectl port-forward -n monitoring svc/kube-prom-stack-prometheus 9090:9090
# → http://localhost:9090

# AlertManager
kubectl port-forward -n monitoring svc/kube-prom-stack-alertmanager 9093:9093
# → http://localhost:9093

# Loki (direct API access)
kubectl port-forward -n logging svc/loki 3100:3100
# → http://localhost:3100

# Tempo (direct API access)
kubectl port-forward -n tracing svc/tempo 3200:3100
# → http://localhost:3200

# Pyroscope
kubectl port-forward -n profiling svc/pyroscope 4040:4040
# → http://localhost:4040
```
