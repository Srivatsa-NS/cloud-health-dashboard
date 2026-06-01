"""
Injects fake ERROR and WARN log events into a CloudWatch log group for testing.
Run from the backend folder with the venv activated:
    python inject_test_errors.py
"""
import time
import boto3
import os
from dotenv import load_dotenv

load_dotenv()

LOG_GROUP  = "/ecs/cloud-health-dashboard"
LOG_STREAM = "test-error-injection"
REGION     = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")

import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
client = boto3.client("logs", region_name=REGION, verify=False)

# ── Ensure the log stream exists ────────────────────────────────────────────
try:
    client.create_log_stream(logGroupName=LOG_GROUP, logStreamName=LOG_STREAM)
    print(f"Created log stream: {LOG_STREAM}")
except client.exceptions.ResourceAlreadyExistsException:
    print(f"Log stream already exists: {LOG_STREAM}")

# ── Build test events ────────────────────────────────────────────────────────
# Timestamps are spread across the last 5 seconds so the next scheduled
# monitor run (up to interval_minutes away) will always find them.
now_ms = int(time.time() * 1000)

def _t(offset_ms):
    """Map an offset in [0, 5000] to a timestamp within the last 5 seconds."""
    return now_ms - 5_000 + offset_ms

events = [
    # Critical / Fatal
    {"timestamp": _t(0),   "message": "FATAL: Out of memory — heap size exceeded 512MB limit, task is being killed"},
    {"timestamp": _t(170), "message": "CRITICAL: Unhandled exception in request handler — NullPointerException at line 142"},
    {"timestamp": _t(340), "message": "CRITICAL: Unhandled exception in request handler — NullPointerException at line 142"},
    {"timestamp": _t(510), "message": "CRITICAL: Unhandled exception in request handler — NullPointerException at line 142"},
    {"timestamp": _t(680), "message": "FATAL: Database cluster unreachable — all connection attempts failed after 60s"},
    {"timestamp": _t(850), "message": "ERROR: Task crashed and restarted — exit code 137 (OOMKilled)"},
    {"timestamp": _t(1020),"message": "ERROR: Task crashed and restarted — exit code 137 (OOMKilled)"},
    {"timestamp": _t(1190),"message": "ERROR: Task crashed and restarted — exit code 137 (OOMKilled)"},
    # Errors
    {"timestamp": _t(1360),"message": "ERROR: Database connection timeout after 30s — retrying (attempt 3/3)"},
    {"timestamp": _t(1530),"message": "ERROR: Database connection timeout after 30s — retrying (attempt 3/3)"},
    {"timestamp": _t(1700),"message": "ERROR: Database connection timeout after 30s — retrying (attempt 3/3)"},
    {"timestamp": _t(1870),"message": "ERROR: Failed to fetch S3 object 'config/app.json' — AccessDenied"},
    {"timestamp": _t(2040),"message": "ERROR: Health check failed — downstream service /api/auth returned 503"},
    {"timestamp": _t(2210),"message": "ERROR: Health check failed — downstream service /api/auth returned 503"},
    {"timestamp": _t(2380),"message": "ERROR: Health check failed — downstream service /api/auth returned 503"},
    {"timestamp": _t(2550),"message": "ERROR: SSL certificate expired for api.internal.cloud — TLS handshake failed"},
    {"timestamp": _t(2720),"message": "ERROR: Payment service timeout — transaction ID txn_9a2c3d rolled back"},
    {"timestamp": _t(2890),"message": "ERROR: Redis cache miss rate exceeded 90% — falling back to database for all requests"},
    {"timestamp": _t(3060),"message": "ERROR: Failed to push metrics to CloudWatch — ThrottlingException"},
    {"timestamp": _t(3230),"message": "ERROR: Container health check failed 3 times consecutively — marking unhealthy"},
    # Warnings
    {"timestamp": _t(3400),"message": "WARN: Response time degraded — /api/ecs took 4200ms (threshold: 2000ms)"},
    {"timestamp": _t(3570),"message": "WARN: Response time degraded — /api/ecs took 5100ms (threshold: 2000ms)"},
    {"timestamp": _t(3740),"message": "WARN: Disk usage at 87% on /dev/xvda1"},
    {"timestamp": _t(3910),"message": "WARN: Disk usage at 91% on /dev/xvda1 — approaching limit"},
    {"timestamp": _t(4080),"message": "WARN: Retrying failed job 'sync-metrics' (attempt 2/5)"},
    {"timestamp": _t(4250),"message": "WARN: Memory usage at 78% — approaching container limit of 512MB"},
    {"timestamp": _t(4420),"message": "WARN: Slow query detected — SELECT * FROM logs took 3200ms"},
    # Info
    {"timestamp": _t(4590),"message": "INFO: Service started successfully on port 5000"},
    {"timestamp": _t(4760),"message": "INFO: GET /api/health 200 OK 12ms"},
    {"timestamp": _t(4930),"message": "INFO: Scheduled job 'cleanup-old-logs' completed in 340ms"},
]

# ── Put log events ────────────────────────────────────────────────────────────
resp = client.put_log_events(
    logGroupName=LOG_GROUP,
    logStreamName=LOG_STREAM,
    logEvents=sorted(events, key=lambda e: e["timestamp"]),
)

print(f"\nInjected {len(events)} events into {LOG_GROUP}")
print(f"  13 ERRORs / CRITICALs / FATALs")
print(f"  7  WARNINGs")
print(f"  3  INFO")
print(f"\nNext: go to the CloudWatch page, open the ⚙ modal for '{LOG_GROUP}',")
print(f"make sure monitoring is enabled, then click 'Run Now'.")
