#!/usr/bin/env bash
# seed-apm-data.sh — 向 ClickHouse 写入模拟 APM 数据，用于验收 APM Pro 功能
# 用法: bash support-files/dev/seed-apm-data.sh
#
# 生成:
#   - 6 个微服务, 多层调用拓扑
#   - ~200 条 traces (过去 1 小时内均匀分布)
#   - 每条 trace 3-8 个 spans (含父子关系)
#   - ~5% 错误率，带 exception.type 属性
#   - 关联日志记录

set -euo pipefail

CH_URL="${CH_URL:-http://localhost:8123}"

echo "🔧 清理旧的模拟数据..."
curl -s "$CH_URL" --data-binary "ALTER TABLE otel.otel_traces DELETE WHERE ServiceName IN ('api-gateway','user-service','order-service','payment-service','inventory-service','notification-service')"
curl -s "$CH_URL" --data-binary "ALTER TABLE otel.otel_logs DELETE WHERE ServiceName IN ('api-gateway','user-service','order-service','payment-service','inventory-service','notification-service')"

# 等 mutation 完成
sleep 2

echo "📊 生成 traces + spans..."

# 用 Python 生成 SQL，因为需要大量随机数据
python3 << 'PYEOF'
import random, uuid, time, datetime, json

random.seed(42)

CH_URL = "http://localhost:8123"

# --- 服务拓扑 ---
# api-gateway → user-service, order-service
# order-service → payment-service, inventory-service
# payment-service → notification-service
# user-service (leaf)
# inventory-service (leaf)
# notification-service (leaf)

SERVICES = {
    "api-gateway": {
        "operations": ["GET /api/users", "POST /api/orders", "GET /api/orders", "GET /api/products", "POST /api/auth/login"],
        "kind": "SPAN_KIND_SERVER",
        "children": {
            "GET /api/users": [("user-service", "getUserById")],
            "POST /api/orders": [("order-service", "createOrder")],
            "GET /api/orders": [("order-service", "listOrders")],
            "GET /api/products": [("inventory-service", "listProducts")],
            "POST /api/auth/login": [("user-service", "authenticate")],
        },
    },
    "user-service": {
        "operations": ["getUserById", "authenticate", "updateProfile", "listUsers"],
        "kind": "SPAN_KIND_SERVER",
        "children": {},
    },
    "order-service": {
        "operations": ["createOrder", "listOrders", "getOrderById", "cancelOrder"],
        "kind": "SPAN_KIND_SERVER",
        "children": {
            "createOrder": [("payment-service", "processPayment"), ("inventory-service", "reserveStock")],
            "cancelOrder": [("payment-service", "refundPayment"), ("inventory-service", "releaseStock")],
        },
    },
    "payment-service": {
        "operations": ["processPayment", "refundPayment", "getPaymentStatus"],
        "kind": "SPAN_KIND_SERVER",
        "children": {
            "processPayment": [("notification-service", "sendReceipt")],
        },
    },
    "inventory-service": {
        "operations": ["reserveStock", "releaseStock", "listProducts", "checkAvailability"],
        "kind": "SPAN_KIND_SERVER",
        "children": {},
    },
    "notification-service": {
        "operations": ["sendReceipt", "sendEmail", "sendSMS"],
        "kind": "SPAN_KIND_SERVER",
        "children": {},
    },
}

# 各服务基准延迟 (ms)
BASE_LATENCY = {
    "api-gateway": 5,
    "user-service": 15,
    "order-service": 20,
    "payment-service": 80,
    "inventory-service": 10,
    "notification-service": 30,
}

# 错误模式
ERROR_PATTERNS = [
    ("payment-service", "processPayment", "PaymentDeclinedException", "Card declined by issuer"),
    ("payment-service", "processPayment", "PaymentTimeoutException", "Payment gateway timeout after 30s"),
    ("inventory-service", "reserveStock", "InsufficientStockException", "Not enough stock for SKU-12345"),
    ("user-service", "authenticate", "AuthenticationException", "Invalid credentials"),
    ("order-service", "createOrder", "ValidationException", "Missing required field: shipping_address"),
    ("notification-service", "sendEmail", "SMTPException", "Connection refused by mail server"),
    ("api-gateway", "POST /api/orders", "RateLimitException", "Rate limit exceeded: 100 req/min"),
]

HTTP_METHODS = {"GET /api/users": "GET", "POST /api/orders": "POST", "GET /api/orders": "GET",
                "GET /api/products": "GET", "POST /api/auth/login": "POST"}

HTTP_URLS = {"GET /api/users": "/api/users/123", "POST /api/orders": "/api/orders",
             "GET /api/orders": "/api/orders?page=1", "GET /api/products": "/api/products",
             "POST /api/auth/login": "/api/auth/login"}

def gen_id():
    return uuid.uuid4().hex

def gen_trace_id():
    return uuid.uuid4().hex

def gen_span_id():
    return uuid.uuid4().hex[:16]

now = datetime.datetime.now(datetime.timezone.utc)
# 生成过去1小时内的数据
start_window = now - datetime.timedelta(hours=1)

traces_rows = []
logs_rows = []

def add_span(trace_id, span_id, parent_span_id, service, operation, kind,
             ts_ns, duration_ns, is_error, error_type, error_msg, span_attrs, depth=0):
    """添加一个 span 行"""
    status_code = "STATUS_CODE_ERROR" if is_error else "STATUS_CODE_OK"
    status_message = error_msg if is_error else ""

    # 构造 SpanAttributes map
    attrs = dict(span_attrs)
    if is_error and error_type:
        attrs["exception.type"] = error_type
        attrs["exception.message"] = error_msg

    attr_str = "{" + ",".join(f"'{k}':'{v}'" for k, v in attrs.items()) + "}"
    res_attrs = "{'service.name':'" + service + "','telemetry.sdk.language':'python','telemetry.sdk.name':'opentelemetry'}"

    # Events
    events_ts = "[]"
    events_name = "[]"
    events_attrs = "[]"
    if is_error and error_type:
        evt_ts = ts_ns + duration_ns  # error at end of span
        events_ts = f"['{datetime.datetime.fromtimestamp(evt_ts / 1e9, tz=datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S.%f')}']"
        events_name = "['exception']"
        events_attrs = "[{" + f"'exception.type':'{error_type}','exception.message':'{error_msg}'" + "}]"

    ts_str = datetime.datetime.fromtimestamp(ts_ns / 1e9, tz=datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S.%f')

    traces_rows.append(
        f"('{ts_str}','{trace_id}','{span_id}','{parent_span_id}','','{operation}','{kind}','{service}',"
        f"{res_attrs},'','',{attr_str},{duration_ns},'{status_code}','{status_message}',"
        f"{events_ts},{events_name},{events_attrs},[],[],[],[])"
    )

    # 生成关联日志
    if is_error:
        log_ts = datetime.datetime.fromtimestamp((ts_ns + duration_ns) / 1e9, tz=datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S.%f')
        body = f"ERROR {error_type}: {error_msg}"
        log_attrs = "{'log.level':'ERROR','logger':'app." + service.replace("-", "_") + "'}"
        logs_rows.append(
            f"('{log_ts}','{trace_id}','{span_id}',0,'ERROR',17,'{service}','{body}','',{res_attrs},'','','',{{}},{log_attrs},'')"
        )
    elif random.random() < 0.3:  # 30% 概率生成 INFO 日志
        log_ts = datetime.datetime.fromtimestamp((ts_ns + int(duration_ns * 0.5)) / 1e9, tz=datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S.%f')
        body = f"Processing {operation} for trace {trace_id[:8]}"
        log_attrs = "{'log.level':'INFO','logger':'app." + service.replace("-", "_") + "'}"
        logs_rows.append(
            f"('{log_ts}','{trace_id}','{span_id}',0,'INFO',9,'{service}','{body}','',{res_attrs},'','','',{{}},{log_attrs},'')"
        )

def gen_subtree(trace_id, parent_span_id, service, operation, kind, ts_ns, force_error=False):
    """递归生成 span 子树，返回总持续时间 (ns)"""
    span_id = gen_span_id()

    base_ms = BASE_LATENCY[service]
    self_duration_ms = max(1, random.gauss(base_ms, base_ms * 0.3))

    # 决定是否报错
    is_error = force_error
    error_type = ""
    error_msg = ""
    if not force_error and random.random() < 0.05:  # 5% 错误率
        # 选一个匹配的错误模式
        matching = [(et, em, msg) for (svc, op, em, msg) in ERROR_PATTERNS
                    if svc == service
                    for et in [em]]
        if matching:
            error_type, _, error_msg = random.choice(matching)
            # 重新匹配
            for (svc, op, et, msg) in ERROR_PATTERNS:
                if svc == service:
                    error_type = et
                    error_msg = msg
                    break
            is_error = True

    # Span 属性
    span_attrs = {}
    if service == "api-gateway" and operation in HTTP_METHODS:
        span_attrs["http.method"] = HTTP_METHODS[operation]
        span_attrs["http.url"] = HTTP_URLS[operation]
        span_attrs["http.status_code"] = "500" if is_error else str(random.choice([200, 200, 200, 201]))
        span_attrs["http.user_agent"] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
        span_attrs["net.peer.ip"] = f"192.168.1.{random.randint(1,254)}"
    elif service == "payment-service":
        span_attrs["payment.provider"] = random.choice(["stripe", "paypal", "alipay"])
        span_attrs["payment.amount"] = str(round(random.uniform(10, 500), 2))
        span_attrs["payment.currency"] = "USD"
    elif service == "user-service":
        span_attrs["db.system"] = "postgresql"
        span_attrs["db.operation"] = random.choice(["SELECT", "INSERT", "UPDATE"])
        span_attrs["user.id"] = f"usr_{random.randint(1000,9999)}"
    elif service == "order-service":
        span_attrs["order.id"] = f"ORD-{random.randint(10000,99999)}"
        span_attrs["db.system"] = "postgresql"
    elif service == "inventory-service":
        span_attrs["product.sku"] = f"SKU-{random.randint(10000,99999)}"
        span_attrs["db.system"] = "redis"
    elif service == "notification-service":
        span_attrs["notification.channel"] = random.choice(["email", "sms", "push"])
        span_attrs["notification.recipient"] = f"user{random.randint(100,999)}@example.com"

    # 递归生成子 span
    children_info = SERVICES[service].get("children", {}).get(operation, [])
    child_total_ns = 0
    child_offset_ns = int(self_duration_ms * 0.1 * 1e6)  # 子 span 在父 span 开始后 10% 处启动

    for child_svc, child_op in children_info:
        child_ts_ns = ts_ns + child_offset_ns
        child_dur = gen_subtree(trace_id, span_id, child_svc, child_op,
                                SERVICES[child_svc]["kind"], child_ts_ns,
                                force_error=(is_error and random.random() < 0.6))
        child_offset_ns += child_dur + int(random.uniform(0.5, 2) * 1e6)
        child_total_ns += child_dur

    # 总持续时间 = 自身 + 子span
    total_duration_ns = max(int(self_duration_ms * 1e6), child_total_ns + int(self_duration_ms * 0.5 * 1e6))

    add_span(trace_id, span_id, parent_span_id, service, operation, kind,
             ts_ns, total_duration_ns, is_error, error_type, error_msg, span_attrs)

    return total_duration_ns


# --- 生成 traces ---
NUM_TRACES = 200

gateway_ops = SERVICES["api-gateway"]["operations"]
# 操作权重: POST /api/orders 最频繁
op_weights = [2, 5, 3, 3, 2]

for i in range(NUM_TRACES):
    trace_id = gen_trace_id()
    # 随机时间戳 (过去1小时内)
    offset_sec = random.uniform(0, 3600)
    ts = start_window + datetime.timedelta(seconds=offset_sec)
    ts_ns = int(ts.timestamp() * 1e9)

    operation = random.choices(gateway_ops, weights=op_weights, k=1)[0]
    gen_subtree(trace_id, "", "api-gateway", operation,
                "SPAN_KIND_SERVER", ts_ns)


# --- 批量写入 ---
import urllib.request

BATCH_SIZE = 100

def execute_sql(sql):
    req = urllib.request.Request("http://localhost:8123/", data=sql.encode("utf-8"))
    with urllib.request.urlopen(req) as resp:
        return resp.read().decode()

# 写入 traces
print(f"  写入 {len(traces_rows)} 个 spans...")
for i in range(0, len(traces_rows), BATCH_SIZE):
    batch = traces_rows[i:i+BATCH_SIZE]
    sql = (
        "INSERT INTO otel.otel_traces "
        "(Timestamp, TraceId, SpanId, ParentSpanId, TraceState, SpanName, SpanKind, ServiceName, "
        "ResourceAttributes, ScopeName, ScopeVersion, SpanAttributes, Duration, StatusCode, StatusMessage, "
        "\"Events.Timestamp\", \"Events.Name\", \"Events.Attributes\", "
        "\"Links.TraceId\", \"Links.SpanId\", \"Links.TraceState\", \"Links.Attributes\") "
        "VALUES " + ",".join(batch)
    )
    execute_sql(sql)

# 写入 logs
print(f"  写入 {len(logs_rows)} 条日志...")
for i in range(0, len(logs_rows), BATCH_SIZE):
    batch = logs_rows[i:i+BATCH_SIZE]
    sql = (
        "INSERT INTO otel.otel_logs "
        "(Timestamp, TraceId, SpanId, TraceFlags, SeverityText, SeverityNumber, ServiceName, Body, "
        "ResourceSchemaUrl, ResourceAttributes, ScopeSchemaUrl, ScopeName, ScopeVersion, "
        "ScopeAttributes, LogAttributes, EventName) "
        "VALUES " + ",".join(batch)
    )
    execute_sql(sql)

print(f"✅ 完成! {NUM_TRACES} traces, {len(traces_rows)} spans, {len(logs_rows)} logs")
PYEOF

echo ""
echo "📈 验证数据..."
echo -n "  Traces (root spans): "
curl -s "$CH_URL" --data-binary "SELECT count() FROM otel.otel_traces WHERE ParentSpanId = '' AND ServiceName IN ('api-gateway','user-service','order-service','payment-service','inventory-service','notification-service')"
echo -n "  Total spans: "
curl -s "$CH_URL" --data-binary "SELECT count() FROM otel.otel_traces WHERE ServiceName IN ('api-gateway','user-service','order-service','payment-service','inventory-service','notification-service')"
echo -n "  Error spans: "
curl -s "$CH_URL" --data-binary "SELECT count() FROM otel.otel_traces WHERE StatusCode = 'STATUS_CODE_ERROR' AND ServiceName IN ('api-gateway','user-service','order-service','payment-service','inventory-service','notification-service')"
echo -n "  Logs: "
curl -s "$CH_URL" --data-binary "SELECT count() FROM otel.otel_logs WHERE ServiceName IN ('api-gateway','user-service','order-service','payment-service','inventory-service','notification-service')"
echo ""
echo "🔍 服务分布:"
curl -s "$CH_URL" --data-binary "SELECT ServiceName, count() as spans, countIf(StatusCode='STATUS_CODE_ERROR') as errors FROM otel.otel_traces WHERE ServiceName IN ('api-gateway','user-service','order-service','payment-service','inventory-service','notification-service') GROUP BY ServiceName ORDER BY spans DESC FORMAT PrettyCompact"
echo ""
echo "🌐 拓扑边 (caller → callee):"
curl -s "$CH_URL" --data-binary "
SELECT
    parent.ServiceName AS caller,
    child.ServiceName AS callee,
    count() AS calls
FROM otel.otel_traces AS child
INNER JOIN otel.otel_traces AS parent
    ON child.ParentSpanId = parent.SpanId AND child.TraceId = parent.TraceId
WHERE child.ServiceName != parent.ServiceName
    AND child.ServiceName IN ('api-gateway','user-service','order-service','payment-service','inventory-service','notification-service')
GROUP BY caller, callee
ORDER BY calls DESC
FORMAT PrettyCompact
"
echo ""
echo "✅ 数据就绪！打开 http://localhost:3000/apm 验收"
