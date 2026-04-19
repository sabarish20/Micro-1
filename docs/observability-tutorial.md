# Monitoring & Observability in Kubernetes
### Fluent Bit · Loki · OpenTelemetry · Grafana

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Fluent Bit Core Concepts](#2-fluent-bit-core-concepts)
3. [Deploying Fluent Bit as a DaemonSet](#3-deploying-fluent-bit-as-a-daemonset)
4. [Full Fluent Bit Configuration](#4-full-fluent-bit-configuration)
   - [SERVICE block](#41-service-block)
   - [INPUTS](#42-inputs)
   - [FILTERS](#43-filters)
   - [OUTPUTS](#44-outputs)
   - [Custom Parsers](#45-custom-parsers)
5. [Pod-Level Log Routing](#5-pod-level-log-routing)
6. [Deploying Loki](#6-deploying-loki)
7. [Loki Label Strategy](#7-loki-label-strategy)
8. [OpenTelemetry Collector Pipeline](#8-opentelemetry-collector-pipeline)
9. [Grafana Setup](#9-grafana-setup)
10. [RBAC for Fluent Bit](#10-rbac-for-fluent-bit)
11. [End-to-End Deploy Order](#11-end-to-end-deploy-order)
12. [LogQL Query Reference](#12-logql-query-reference)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Kubernetes Cluster                        │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │
│  │  Pod/App │  │  Pod/App │  │  Pod/App │   (your workloads)    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                       │
│       │              │              │  logs written to            │
│       └──────────────┴──────────────┘  /var/log/containers/      │
│                          │                                        │
│              ┌───────────▼───────────┐                           │
│              │   Fluent Bit          │  ← DaemonSet (1 per node) │
│              │  ┌─────────────────┐  │                           │
│              │  │  INPUT          │  │  tail /var/log/containers │
│              │  │  FILTER         │  │  enrich + parse + route   │
│              │  │  OUTPUT         │  │  forward to backend       │
│              │  └─────────────────┘  │                           │
│              └───────────┬───────────┘                           │
│                          │                                        │
│          ┌───────────────┼───────────────┐                       │
│          ▼               ▼               ▼                       │
│   ┌─────────────┐ ┌───────────┐ ┌──────────────┐               │
│   │    Loki     │ │  OTel     │ │Elasticsearch │               │
│   │  (storage)  │ │ Collector │ │  (optional)  │               │
│   └──────┬──────┘ └─────┬─────┘ └──────────────┘               │
│          │               │                                        │
│          └───────┬────────┘                                      │
│                  ▼                                                │
│            ┌──────────┐                                          │
│            │  Grafana │  (visualization)                         │
│            └──────────┘                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Why this stack?

| Component | Role | Why |
|-----------|------|-----|
| **Fluent Bit** | Log collector / shipper | Lightweight (~450KB), runs on every node, rich filtering |
| **Loki** | Log storage & indexing | Indexes labels only (not full text) — cheap and fast |
| **OTel Collector** | Vendor-neutral pipeline hub | Unifies logs, metrics, and traces in one place |
| **Grafana** | Visualization & alerting | LogQL queries, dashboards, multi-datasource correlation |

---

## 2. Fluent Bit Core Concepts

Fluent Bit processes logs in a linear pipeline:

```
INPUT  →  PARSER  →  FILTER  →  OUTPUT
```

### Pipeline Stages

| Stage | Purpose | Examples |
|-------|---------|---------|
| **INPUT** | Where logs come from | `tail` (files), `systemd`, `http`, `tcp`, `kubernetes_events` |
| **PARSER** | Decode raw text into structured fields | `json`, `regex`, `cri`, `nginx`, `apache` |
| **FILTER** | Transform, enrich, drop, or route records | `kubernetes`, `grep`, `rewrite_tag`, `record_modifier`, `nest` |
| **OUTPUT** | Where processed logs go | `loki`, `opentelemetry`, `elasticsearch`, `s3`, `stdout` |

### Tags — the routing mechanism

Every log record carries a **tag** — a string that controls which filters and outputs handle it.

```
kube.var.log.containers.my-app-7d9f_production_api-abc123.log
      ────────────────────────────────────────────────────────
      Fluent Bit auto-generates this from the file path
```

Use tags in `Match` fields to route records:

```ini
Match  kube.*           # all container logs
Match  kube.*payments*  # only containers with "payments" in their filename
Match  host.*           # systemd / node-level logs
Match  prod.*           # logs retagged to prod.* by rewrite_tag filter
Match  *                # everything
```

---

## 3. Deploying Fluent Bit as a DaemonSet

A **DaemonSet** ensures one Fluent Bit pod runs on every node in the cluster, so no node's logs are missed.

### Add the Helm repo

```bash
helm repo add fluent https://fluent.github.io/helm-charts
helm repo update
```

### Install

```bash
helm install fluent-bit fluent/fluent-bit \
  --namespace logging \
  --create-namespace \
  --values fluentbit-values.yaml
```

### Verify

```bash
# Confirm one pod per node
kubectl get pods -n logging -o wide

# Watch logs in real time
kubectl logs -n logging daemonset/fluent-bit -f

# Check built-in metrics endpoint
kubectl port-forward -n logging daemonset/fluent-bit 2020
curl http://localhost:2020/api/v1/metrics
```

---

## 4. Full Fluent Bit Configuration

The entire configuration lives in `fluentbit-values.yaml` passed to Helm.

### 4.1 SERVICE block

```ini
[SERVICE]
    Flush         5          # send buffered records every 5 seconds
    Daemon        Off        # must be Off inside a container
    Log_Level     info       # debug | info | warn | error
    Parsers_File  /fluent-bit/etc/parsers.conf
    Parsers_File  /fluent-bit/etc/conf/custom_parsers.conf
    HTTP_Server   On         # exposes /api/v1/metrics for Prometheus scraping
    HTTP_Listen   0.0.0.0
    HTTP_Port     2020
    storage.metrics on       # expose storage metrics at the HTTP endpoint
```

### 4.2 INPUTS

```ini
# ── Container logs from every pod on this node ──────────────────────────────
[INPUT]
    Name              tail
    Tag               kube.*
    Path              /var/log/containers/*.log
    Exclude_Path      /var/log/containers/fluent-bit*.log   # avoid collecting own logs
    Parser            cri           # for containerd / CRI-O runtimes (most modern clusters)
    # Parser          docker        # use this for older Docker-runtime clusters
    DB                /var/log/flb_kube.db   # SQLite DB tracks read offsets — survives pod restarts
    Mem_Buf_Limit     50MB
    Skip_Long_Lines   On
    Refresh_Interval  10

# ── Kubernetes node system logs via systemd ──────────────────────────────────
[INPUT]
    Name            systemd
    Tag             host.*
    Systemd_Filter  _SYSTEMD_UNIT=kubelet.service
    Systemd_Filter  _SYSTEMD_UNIT=containerd.service
    Read_From_Tail  On
    Strip_Underscores On   # removes leading _ from systemd field names
```

> **How `tail` works with Kubernetes:**
> Kubernetes writes every container's stdout/stderr to `/var/log/containers/<pod>_<namespace>_<container>-<id>.log`.
> Fluent Bit tails these files and the file path itself becomes part of the tag, which is later parsed
> by the `kubernetes` filter to extract pod name, namespace, and container name.

### 4.3 FILTERS

Filters are applied in order. Each filter only processes records whose tag matches its `Match` pattern.

```ini
# ── 1. Enrich with Kubernetes metadata ──────────────────────────────────────
#    Calls the K8s API to add: namespace, pod name, container name,
#    node name, pod labels, pod annotations to every record.
[FILTER]
    Name                kubernetes
    Match               kube.*
    Kube_URL            https://kubernetes.default.svc:443
    Kube_CA_File        /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    Kube_Token_File     /var/run/secrets/kubernetes.io/serviceaccount/token
    Kube_Tag_Prefix     kube.var.log.containers.
    Merge_Log           On     # if the app logs JSON, merge its fields into the record
    Merge_Log_Key       log_processed
    Keep_Log            Off    # drop the raw "log" string field after merging
    K8S-Logging.Parser  On     # honor fluentbit.io/parser pod annotation
    K8S-Logging.Exclude On     # honor fluentbit.io/exclude: "true" pod annotation

# ── 2. Lift nested kubernetes{} object to top-level fields ──────────────────
#    Converts kubernetes.namespace_name → kubernetes_namespace_name
#    Required so these fields can be used as Loki label references ($field)
[FILTER]
    Name         nest
    Match        kube.*
    Operation    lift
    Nested_under kubernetes
    Add_prefix   kubernetes_

# ── 3. Route by namespace using rewrite_tag ──────────────────────────────────
#    Creates new records with a different tag — the original record is kept
#    unless you set Keep_Original Off
[FILTER]
    Name    rewrite_tag
    Match   kube.*
    Rule    $kubernetes_namespace_name ^(production)$  prod.$TAG  false
    Rule    $kubernetes_namespace_name ^(staging)$     staging.$TAG  false
    Rule    $kubernetes_namespace_name ^(monitoring)$  monitoring.$TAG  false

# ── 4. Drop health-check and noise logs ──────────────────────────────────────
[FILTER]
    Name    grep
    Match   kube.*
    Exclude log  /healthz|/readyz|/livez|/metrics

# ── 5. Add static fields to every record ─────────────────────────────────────
[FILTER]
    Name   record_modifier
    Match  *
    Record cluster  my-k8s-cluster
    Record env      production
```

### 4.4 OUTPUTS

You can have multiple outputs. Records are sent to all outputs whose `Match` pattern fits.

```ini
# ── Send ALL logs to Loki ────────────────────────────────────────────────────
[OUTPUT]
    Name              loki
    Match             *
    Host              loki.logging.svc.cluster.local
    Port              3100
    Labels            job=fluent-bit,
                      cluster=$cluster,
                      namespace=$kubernetes_namespace_name,
                      pod=$kubernetes_pod_name,
                      container=$kubernetes_container_name,
                      node=$kubernetes_host
    Label_Keys        $level,$severity        # promote app log fields to Loki labels
    Line_Format       json
    Auto_Kubernetes_Labels On

# ── Send prod logs ALSO to OTel Collector ────────────────────────────────────
[OUTPUT]
    Name          opentelemetry
    Match         prod.*
    Host          otel-collector.observability.svc.cluster.local
    Port          4318
    logs_uri      /v1/logs
    tls           Off

# ── Debug output — prints to container stdout (disable in production) ─────────
# [OUTPUT]
#     Name   stdout
#     Match  *
```

### 4.5 Custom Parsers

```ini
# ── NGINX access log parser ───────────────────────────────────────────────────
[PARSER]
    Name        nginx
    Format      regex
    Regex       ^(?<remote>[^ ]*) (?<host>[^ ]*) (?<user>[^ ]*) \[(?<time>[^\]]*)\] "(?<method>\S+)(?: +(?<path>[^\"]*?)(?: +\S*)?)?" (?<code>[^ ]*) (?<size>[^ ]*)(?: "(?<referer>[^\"]*)" "(?<agent>[^\"]*)")?$
    Time_Key    time
    Time_Format %d/%b/%Y:%H:%M:%S %z

# ── Structured JSON application log parser ───────────────────────────────────
[PARSER]
    Name        json_app
    Format      json
    Time_Key    timestamp
    Time_Format %Y-%m-%dT%H:%M:%S.%LZ

# ── CRI-O / containerd log format (standard in modern K8s) ───────────────────
[PARSER]
    Name        cri
    Format      regex
    Regex       ^(?<time>[^ ]+) (?<stream>stdout|stderr) (?<logtag>[^ ]*) ?(?<log>.*)$
    Time_Key    time
    Time_Format %Y-%m-%dT%H:%M:%S.%L%z
```

### Complete `fluentbit-values.yaml`

```yaml
# fluentbit-values.yaml

image:
  tag: "3.2.0"

kind: DaemonSet

tolerations:
  - key: node-role.kubernetes.io/master
    operator: Exists
    effect: NoSchedule
  - key: node-role.kubernetes.io/control-plane
    operator: Exists
    effect: NoSchedule

extraVolumes:
  - name: varlog
    hostPath:
      path: /var/log
  - name: varlibdockercontainers
    hostPath:
      path: /var/lib/docker/containers

extraVolumeMounts:
  - name: varlog
    mountPath: /var/log
    readOnly: true
  - name: varlibdockercontainers
    mountPath: /var/lib/docker/containers
    readOnly: true

serviceAccount:
  create: true

config:
  service: |
    [SERVICE]
        Flush         5
        Daemon        Off
        Log_Level     info
        Parsers_File  /fluent-bit/etc/parsers.conf
        Parsers_File  /fluent-bit/etc/conf/custom_parsers.conf
        HTTP_Server   On
        HTTP_Listen   0.0.0.0
        HTTP_Port     2020
        storage.metrics on

  inputs: |
    [INPUT]
        Name              tail
        Tag               kube.*
        Path              /var/log/containers/*.log
        Exclude_Path      /var/log/containers/fluent-bit*.log
        Parser            cri
        DB                /var/log/flb_kube.db
        Mem_Buf_Limit     50MB
        Skip_Long_Lines   On
        Refresh_Interval  10

    [INPUT]
        Name            systemd
        Tag             host.*
        Systemd_Filter  _SYSTEMD_UNIT=kubelet.service
        Systemd_Filter  _SYSTEMD_UNIT=containerd.service
        Read_From_Tail  On
        Strip_Underscores On

  filters: |
    [FILTER]
        Name                kubernetes
        Match               kube.*
        Kube_URL            https://kubernetes.default.svc:443
        Kube_CA_File        /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
        Kube_Token_File     /var/run/secrets/kubernetes.io/serviceaccount/token
        Kube_Tag_Prefix     kube.var.log.containers.
        Merge_Log           On
        Merge_Log_Key       log_processed
        Keep_Log            Off
        K8S-Logging.Parser  On
        K8S-Logging.Exclude On

    [FILTER]
        Name         nest
        Match        kube.*
        Operation    lift
        Nested_under kubernetes
        Add_prefix   kubernetes_

    [FILTER]
        Name    rewrite_tag
        Match   kube.*
        Rule    $kubernetes_namespace_name ^(production)$  prod.$TAG  false
        Rule    $kubernetes_namespace_name ^(staging)$     staging.$TAG  false

    [FILTER]
        Name    grep
        Match   kube.*
        Exclude log  /healthz|/readyz|/livez

    [FILTER]
        Name   record_modifier
        Match  *
        Record cluster  my-k8s-cluster
        Record env      production

  outputs: |
    [OUTPUT]
        Name              loki
        Match             *
        Host              loki.logging.svc.cluster.local
        Port              3100
        Labels            job=fluent-bit, cluster=$cluster, namespace=$kubernetes_namespace_name, pod=$kubernetes_pod_name, container=$kubernetes_container_name
        Label_Keys        $level,$severity
        Line_Format       json
        Auto_Kubernetes_Labels On

    [OUTPUT]
        Name          opentelemetry
        Match         prod.*
        Host          otel-collector.observability.svc.cluster.local
        Port          4318
        logs_uri      /v1/logs
        tls           Off

  customParsers: |
    [PARSER]
        Name        nginx
        Format      regex
        Regex       ^(?<remote>[^ ]*) (?<host>[^ ]*) (?<user>[^ ]*) \[(?<time>[^\]]*)\] "(?<method>\S+)(?: +(?<path>[^\"]*?)(?: +\S*)?)?" (?<code>[^ ]*) (?<size>[^ ]*)(?: "(?<referer>[^\"]*)" "(?<agent>[^\"]*)")?$
        Time_Key    time
        Time_Format %d/%b/%Y:%H:%M:%S %z

    [PARSER]
        Name        json_app
        Format      json
        Time_Key    timestamp
        Time_Format %Y-%m-%dT%H:%M:%S.%LZ
```

---

## 5. Pod-Level Log Routing

### Control Fluent Bit per pod using annotations

You can tell Fluent Bit how to handle a specific pod's logs without changing the central config. Add these annotations to your `Deployment` or `Pod` spec:

```yaml
metadata:
  annotations:
    # Use the 'nginx' parser defined in customParsers for this pod's logs
    fluentbit.io/parser: "nginx"

    # Use the JSON app parser
    fluentbit.io/parser: "json_app"

    # Completely exclude this pod from log collection
    fluentbit.io/exclude: "true"
```

For this to work, the `kubernetes` filter must have both of these set:

```ini
K8S-Logging.Parser  On
K8S-Logging.Exclude On
```

### Route specific services to dedicated Loki streams

```ini
# In the outputs section — collect payments service to a separate Loki instance
[OUTPUT]
    Name   loki
    Match  kube.*payments*
    Host   loki-payments.logging.svc.cluster.local
    Port   3100
    Labels job=payments, namespace=$kubernetes_namespace_name
```

### How the tag encodes pod identity

```
kube.var.log.containers.payments-api-7d9f_production_api-abc123.log
                         ───────────────  ──────────  ───
                         pod name         namespace   container name
```

---

## 6. Deploying Loki

Loki stores log data indexed by **labels** (not full text). It is designed to pair with Fluent Bit and Grafana.

### `loki-values.yaml`

```yaml
loki:
  commonConfig:
    replication_factor: 1

  schemaConfig:
    configs:
      - from: "2024-04-01"
        store: tsdb
        object_store: filesystem
        schema: v13
        index:
          prefix: loki_index_
          period: 24h

  # Required even for filesystem storage — satisfies Helm chart template validation
  storage:
    type: filesystem
    bucketNames:
      chunks: chunks
      ruler: ruler
      admin: admin

  limits_config:
    allow_structured_metadata: true
    volume_enabled: true

  pattern_ingester:
    enabled: true

  ruler:
    enable_api: true

minio:
  enabled: false

deploymentMode: SingleBinary

singleBinary:
  replicas: 1

# Zero out all other deployment mode replicas
backend:
  replicas: 0
read:
  replicas: 0
write:
  replicas: 0
ingester:
  replicas: 0
querier:
  replicas: 0
queryFrontend:
  replicas: 0
queryScheduler:
  replicas: 0
distributor:
  replicas: 0
compactor:
  replicas: 0
indexGateway:
  replicas: 0
bloomCompactor:
  replicas: 0
bloomGateway:
  replicas: 0
```

### Install

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

helm install loki grafana/loki \
  --namespace logging \
  --create-namespace \
  --values loki-values.yaml
```

---

## 7. Loki Label Strategy

Loki indexes by **labels**, not by log content. Choosing labels correctly is the most important performance decision.

### Rules

| Rule | Explanation |
|------|-------------|
| **Low cardinality only** | Labels should have a small, bounded set of values |
| **Never high-cardinality fields as labels** | `pod_id`, `trace_id`, `user_id`, `request_id` → put these in the log body |
| **Keep label count small** | 3–6 labels per stream is ideal |

### Good vs Bad labels

```
✅ Good (low cardinality):    namespace, app, env, cluster, level, service
❌ Bad  (high cardinality):   pod_id, trace_id, user_id, ip_address, request_id
```

### Loki OUTPUT label config

```ini
[OUTPUT]
    Name    loki
    Match   kube.*
    Host    loki.logging.svc.cluster.local
    Port    3100
    # These become Loki stream selectors — keep them low cardinality
    Labels  job=fluent-bit,
            cluster=$cluster,
            namespace=$kubernetes_namespace_name,
            app=$kubernetes_labels_app,
            container=$kubernetes_container_name
    # Everything else goes into the log line body — searchable with LogQL
    Line_Format  json
```

---

## 8. OpenTelemetry Collector Pipeline

Use the OTel Collector when you want a **vendor-neutral hub** that handles logs, metrics, and traces in one place.

```
Fluent Bit  →  OTel Collector  →  Loki / Tempo / Prometheus
```

### `otelcol-config.yaml`

```yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
      grpc:
        endpoint: 0.0.0.0:4317

processors:
  batch:
    timeout: 5s
  resource:
    attributes:
      - action: insert
        key: loki.resource.labels
        value: service.name, k8s.namespace.name, k8s.pod.name
  # Drop debug logs in production
  filter/drop_debug:
    logs:
      exclude:
        match_type: strict
        severity_texts: ["DEBUG", "TRACE"]

exporters:
  loki:
    endpoint: http://loki.logging.svc.cluster.local:3100/loki/api/v1/push
  # Send traces to Tempo
  otlp/tempo:
    endpoint: http://tempo.observability.svc.cluster.local:4317
    tls:
      insecure: true
  debug:
    verbosity: normal

service:
  pipelines:
    logs:
      receivers:  [otlp]
      processors: [batch, resource, filter/drop_debug]
      exporters:  [loki]
    traces:
      receivers:  [otlp]
      processors: [batch]
      exporters:  [otlp/tempo]
```

### Install OTel Collector via Helm

```bash
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update

helm install otel-collector open-telemetry/opentelemetry-collector \
  --namespace observability \
  --create-namespace \
  --values otelcol-values.yaml
```

---

## 9. Grafana Setup

### Install Grafana

```bash
helm install grafana grafana/grafana \
  --namespace observability \
  --create-namespace \
  --set adminPassword=admin \
  --set service.type=LoadBalancer
```

### Provision Loki as a datasource automatically

```yaml
# grafana-datasource-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-datasources
  namespace: observability
  labels:
    grafana_datasource: "1"
data:
  loki.yaml: |
    apiVersion: 1
    datasources:
      - name: Loki
        type: loki
        url: http://loki.logging.svc.cluster.local:3100
        access: proxy
        isDefault: false
        jsonData:
          maxLines: 5000
          derivedFields:
            # Automatically turn trace IDs in logs into clickable links to Tempo
            - name: TraceID
              matcherRegex: '"traceId":"(\w+)"'
              url: '$${__value.raw}'
              datasourceUid: tempo
```

### Access Grafana

```bash
# Get the admin password (if auto-generated)
kubectl get secret -n observability grafana -o jsonpath="{.data.admin-password}" | base64 --decode

# Port-forward to access locally
kubectl port-forward -n observability svc/grafana 3000:80
# Open http://localhost:3000
```

---

## 10. RBAC for Fluent Bit

Fluent Bit needs Kubernetes API access to enrich logs with pod metadata.

```yaml
# fluent-bit-rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: fluent-bit
  namespace: logging
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: fluent-bit-read
rules:
  - apiGroups: [""]
    resources: ["namespaces", "pods", "nodes", "nodes/proxy"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: fluent-bit-read
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: fluent-bit-read
subjects:
  - kind: ServiceAccount
    name: fluent-bit
    namespace: logging
```

> The Helm chart creates RBAC automatically when `serviceAccount.create: true` (default). You only need this manifest if installing manually.

---

## 11. End-to-End Deploy Order

```bash
# ── Step 1: Create namespaces ─────────────────────────────────────────────────
kubectl create namespace logging
kubectl create namespace observability

# ── Step 2: Add all Helm repos ────────────────────────────────────────────────
helm repo add grafana    https://grafana.github.io/helm-charts
helm repo add fluent     https://fluent.github.io/helm-charts
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update

# ── Step 3: Deploy Loki ───────────────────────────────────────────────────────
helm install loki grafana/loki \
  --namespace logging \
  --values loki-values.yaml

# ── Step 4: Deploy Fluent Bit ─────────────────────────────────────────────────
helm install fluent-bit fluent/fluent-bit \
  --namespace logging \
  --values fluentbit-values.yaml

# ── Step 5: Deploy OTel Collector (optional) ──────────────────────────────────
helm install otel-collector open-telemetry/opentelemetry-collector \
  --namespace observability \
  --values otelcol-values.yaml

# ── Step 6: Deploy Grafana ────────────────────────────────────────────────────
helm install grafana grafana/grafana \
  --namespace observability \
  --set adminPassword=admin \
  --set service.type=LoadBalancer

# ── Step 7: Apply datasource configmap ───────────────────────────────────────
kubectl apply -f grafana-datasource-configmap.yaml

# ── Step 8: Verify everything is running ──────────────────────────────────────
kubectl get pods -n logging
kubectl get pods -n observability

# ── Step 9: Check Fluent Bit pipeline health ──────────────────────────────────
kubectl logs -n logging daemonset/fluent-bit --tail=50

# ── Step 10: Fire a test log and query it in Grafana ──────────────────────────
kubectl run test-log --image=busybox --restart=Never \
  -- sh -c 'echo "{\"level\":\"error\",\"msg\":\"test error from observability tutorial\"}"'

# Wait ~10s then query in Grafana Explore:
# {namespace="default"} | json | level="error"
```

---

## 12. LogQL Query Reference

LogQL is Loki's query language. It has two types:

### Log queries (return log lines)

```logql
# All logs from a namespace
{namespace="production"}

# Logs from a specific app
{namespace="production", app="payments"}

# Filter log lines containing a string
{namespace="production"} |= "ERROR"

# Exclude lines matching a string
{namespace="production"} != "healthz"

# Parse JSON log body and filter on a field
{namespace="production"} | json | level="error"

# Filter by numeric field value
{namespace="production"} | json | duration_ms > 500

# Regex match on a field
{namespace="production"} | json | path =~ "/api/v.*"

# Multi-stage pipeline
{namespace="production", app="payments"}
  | json
  | level="error"
  | line_format "{{.timestamp}} {{.msg}} — trace={{.traceId}}"
```

### Metric queries (return time-series)

```logql
# Error rate per minute
rate({namespace="production"} |= "ERROR" [1m])

# Request count by status code
sum by (status_code) (
  rate({app="nginx"} | json [5m])
)

# P99 latency (if duration_ms is a log field)
quantile_over_time(0.99,
  {app="payments"} | json | unwrap duration_ms [5m]
) by (pod)

# Log volume by namespace
sum by (namespace) (
  rate({job="fluent-bit"}[5m])
)
```

---

## 13. Troubleshooting

### Fluent Bit not collecting logs

```bash
# Check if the DaemonSet is running on all nodes
kubectl get daemonset -n logging fluent-bit

# Check for config errors in pod logs
kubectl logs -n logging daemonset/fluent-bit | grep -i error

# Enable debug output temporarily
# In fluentbit-values.yaml, change:
#   Log_Level  debug
# and add an stdout output:
#   [OUTPUT]
#       Name  stdout
#       Match *
```

### Logs not appearing in Loki

```bash
# Check Loki is healthy
kubectl logs -n logging statefulset/loki

# Test Loki's push API directly
curl -X POST http://loki.logging.svc.cluster.local:3100/loki/api/v1/push \
  -H "Content-Type: application/json" \
  -d '{"streams":[{"stream":{"job":"test"},"values":[["'$(date +%s%N)'","hello loki"]]}]}'

# Query it back
curl "http://loki.logging.svc.cluster.local:3100/loki/api/v1/query_range" \
  --data-urlencode 'query={job="test"}' \
  --data-urlencode 'start=1h ago'
```

### Kubernetes metadata not enriched on log records

```bash
# Confirm the ServiceAccount has the correct RBAC
kubectl auth can-i list pods --as=system:serviceaccount:logging:fluent-bit

# Check the kubernetes filter is matching
# Ensure Kube_Tag_Prefix matches what tail INPUT produces
# kube.var.log.containers. is the default when Path=/var/log/containers/*.log
```

### High cardinality Loki performance issues

- Remove `pod` from Labels (high cardinality — thousands of unique pods)
- Only keep: `namespace`, `app`, `container`, `env`, `cluster`
- Move `pod_name` into the log body — query it with `| json | kubernetes_pod_name="..."`

---

## Summary — Full Pipeline

```
Pod logs (stdout/stderr)
        │
        ▼  /var/log/containers/*.log  (host volume mount)
   Fluent Bit (DaemonSet — 1 per node)
        │
        ├─ INPUT:   tail container logs + systemd node logs
        ├─ FILTER:  kubernetes enrichment → lift fields → rewrite_tag → grep → record_modifier
        └─ OUTPUT:  route by tag/namespace
                │
        ┌───────┴────────┐
        ▼                ▼
      Loki          OTel Collector
  (log storage)  (vendor-neutral hub)
        │                │
        └──────┬──────────┘
               ▼
            Grafana
       (LogQL queries,
        dashboards,
        alerts,
        trace correlation)
```

**Core principle:** Fluent Bit collects and enriches cheaply at the edge. Loki stores efficiently using label indexing. Grafana provides the query and visualization layer. Each component does one thing well.
