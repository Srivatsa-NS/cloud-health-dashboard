import json
import re
import time
import threading
from pathlib import Path
from flask import Blueprint, jsonify, request
from apscheduler.schedulers.background import BackgroundScheduler
from config import boto_client

bp = Blueprint("monitor", __name__)

# Config is persisted to this file so settings survive server restarts
_CONFIG_FILE = Path(__file__).parent.parent / "monitor_config.json"

# ---------------------------------------------------------------------------
# Per-group state
# _group_configs: { group_name -> { enabled, interval_minutes, email,
#                                   last_run, next_run, last_error, running } }
# ---------------------------------------------------------------------------
_group_configs = {}
_alerts = []          # all alerts, newest first, max 50
_lock = threading.Lock()
_scheduler = BackgroundScheduler(daemon=True)
_scheduler.start()


def _load_config():
    """Load persisted group configs from disk on startup."""
    global _group_configs
    try:
        if _CONFIG_FILE.exists():
            with open(_CONFIG_FILE) as f:
                data = json.load(f)
            for cfg in data.values():
                cfg["running"] = False   # reset runtime field
            _group_configs = data
    except Exception:
        pass


def _save_config():
    """Persist current group configs to disk (excludes runtime-only fields)."""
    try:
        runtime_keys = {"running"}
        snapshot = {
            group: {k: v for k, v in cfg.items() if k not in runtime_keys}
            for group, cfg in _group_configs.items()
        }
        with open(_CONFIG_FILE, "w") as f:
            json.dump(snapshot, f, indent=2)
    except Exception:
        pass


_load_config()

# ---------------------------------------------------------------------------
# Template grouping helpers
# ---------------------------------------------------------------------------
_VAR_PATTERNS = [
    (re.compile(r'\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b', re.I), '[UUID]'),
    (re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b'), '[IP]'),
    (re.compile(r'\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b'), '[TIMESTAMP]'),
    (re.compile(r'\b\d{2}:\d{2}:\d{2}(?:\.\d+)?\b'), '[TIME]'),
    (re.compile(r'(?<=[(\[/ ])[0-9a-f]{6,64}(?=[)\]/ ]|$)', re.I), '[HEX]'),
    (re.compile(r'\b\d+(?:\.\d+)?(?:ms|s|MB|GB|KB|%|px)?\b'), '[N]'),
    (re.compile(r'"[^"]{0,80}"'), '[STR]'),
]


def _template(message):
    s = message.strip()
    for pattern, replacement in _VAR_PATTERNS:
        s = pattern.sub(replacement, s)
    return re.sub(r'\s+', ' ', s).strip()[:180]


def _classify_level(message):
    upper = message.upper()
    if any(kw in upper for kw in ("ERROR", "EXCEPTION", "FATAL", "CRITICAL")):
        return "ERROR"
    elif "WARN" in upper:
        return "WARN"
    return "INFO"


def _parse_bedrock_json(raw):
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    start, end = raw.find("["), raw.rfind("]")
    if start != -1 and end != -1:
        return json.loads(raw[start:end + 1])
    raise ValueError("No JSON array in response")


# ---------------------------------------------------------------------------
# Per-group monitor job factory
# ---------------------------------------------------------------------------
def _make_job(group_name):
    """Return a job function bound to a specific log group."""
    def job():
        with _lock:
            cfg = _group_configs.get(group_name)
            if not cfg or cfg.get("running"):
                return
            cfg["running"] = True
            cfg["last_error"] = None

        try:
            with _lock:
                interval_minutes = _group_configs[group_name]["interval_minutes"]
                email = _group_configs[group_name].get("email", "")

            logs_client = boto_client("logs")
            now_ms = int(time.time() * 1000)
            window_ms = interval_minutes * 60 * 1000

            resp = logs_client.filter_log_events(
                logGroupName=group_name,
                startTime=now_ms - window_ms,
                endTime=now_ms,
                limit=500,
            )
            events = resp.get("events", [])
            if not events:
                return

            templates = {}
            for event in events:
                msg = event.get("message", "").strip()
                level = _classify_level(msg)
                tmpl = _template(msg)
                key = (level, tmpl)
                if key in templates:
                    templates[key]["count"] += 1
                else:
                    templates[key] = {"template": tmpl, "level": level, "count": 1, "sample": msg[:200]}

            payload = []
            for lvl, limit in [("ERROR", 15), ("WARN", 10), ("INFO", 5)]:
                bucket = sorted(
                    [v for v in templates.values() if v["level"] == lvl],
                    key=lambda x: x["count"], reverse=True,
                )[:limit]
                payload.extend(bucket)

            # Build 1 INFO summary item unconditionally so the pipeline
            # (scheduler → email → toaster) is always testable.
            info_bucket = sorted(
                [v for v in templates.values() if v["level"] == "INFO"],
                key=lambda x: x["count"], reverse=True,
            )
            if info_bucket:
                top = info_bucket[0]
                info_summary = (
                    f"Top pattern: \"{top['template'][:80]}\" ({top['count']}×). "
                    f"{len(events)} total events scanned in the last {interval_minutes} min."
                )
            else:
                info_summary = (
                    f"{len(events)} total events scanned in the last {interval_minutes} min. "
                    "No INFO-level patterns detected."
                )
            info_issue = {
                "severity": "info",
                "title": "Log activity summary",
                "description": info_summary,
                "action": "Informational only — no action required.",
            }

            # Run Bedrock analysis only when there are errors/warnings
            issues = []
            if any(p["level"] in ("ERROR", "WARN") for p in payload):
                prompt = f"""You are a cloud infrastructure expert monitoring AWS CloudWatch logs.
The following log patterns were detected in log group "{group_name}" over the last {interval_minutes} minutes.
{len(events)} total events collected, compressed into {len(templates)} unique templates.

Patterns (sorted by frequency):
{json.dumps(payload, indent=2)}

Respond ONLY with a JSON array. Each item must have:
- "severity": "critical" or "warning"
- "title": short title (max 10 words)
- "description": what is happening and why it matters (2-3 sentences)
- "action": specific remediation step

Only critical and warning items. No info. No preamble."""

                bedrock = boto_client("bedrock-runtime")
                response = bedrock.invoke_model(
                    modelId="meta.llama3-8b-instruct-v1:0",
                    body=json.dumps({
                        "prompt": f"<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n{prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>",
                        "max_gen_len": 2048,
                        "temperature": 0.1,
                    }),
                )
                raw = json.loads(response["body"].read())["generation"]
                try:
                    issues = _parse_bedrock_json(raw)
                except Exception:
                    pass  # Bedrock parse failed; INFO item still goes through

            # Always append the INFO summary so the full pipeline is exercised
            issues.append(info_issue)

            new_alert = {
                "id": f"{int(time.time())}-{group_name}",
                "group": group_name,
                "issues": issues,
                "window_minutes": interval_minutes,
                "raw_event_count": len(events),
                "timestamp": time.time(),
                "read": False,
            }
            with _lock:
                _alerts.insert(0, new_alert)
                del _alerts[50:]
            if email:
                _send_email(email, new_alert)

        except Exception as e:
            with _lock:
                if group_name in _group_configs:
                    _group_configs[group_name]["last_error"] = str(e)
        finally:
            with _lock:
                if group_name in _group_configs:
                    _group_configs[group_name]["running"] = False
                    _group_configs[group_name]["last_run"] = time.time()

    return job


def _reschedule_group(group_name):
    job_id = f"monitor-{group_name}"
    if _scheduler.get_job(job_id):
        _scheduler.remove_job(job_id)

    cfg = _group_configs.get(group_name)
    if cfg and cfg["enabled"] and cfg["interval_minutes"] > 0:
        _scheduler.add_job(
            _make_job(group_name),
            trigger="interval",
            minutes=cfg["interval_minutes"],
            id=job_id,
            replace_existing=True,
        )
        _group_configs[group_name]["next_run"] = time.time() + cfg["interval_minutes"] * 60
    else:
        if cfg:
            cfg["next_run"] = None


def _send_email(to_email, alert):
    ses = boto_client("ses")
    lines = [
        f"Log Group: {alert['group']}",
        f"Window: last {alert['window_minutes']} minutes ({alert['raw_event_count']} events)",
        "",
    ]
    for issue in alert.get("issues", []):
        lines += [
            f"[{issue.get('severity','').upper()}] {issue.get('title','')}",
            f"  {issue.get('description','')}",
            f"  Action: {issue.get('action','')}",
            "",
        ]
    try:
        ses.send_email(
            Source=to_email,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": f"CloudPulse Alert — {alert['group']} needs attention"},
                "Body": {"Text": {"Data": "\n".join(lines)}},
            },
        )
    except Exception:
        pass


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

@bp.route("/api/monitor/config", methods=["GET"])
def get_group_config():
    group = request.args.get("group")
    if not group:
        return jsonify({"error": "group parameter required"}), 400
    with _lock:
        cfg = _group_configs.get(group) or {
            "enabled": False, "interval_minutes": 60, "email": "",
            "last_run": None, "next_run": None, "running": False, "last_error": None,
        }
        return jsonify(cfg)


@bp.route("/api/monitor/config", methods=["POST"])
def update_group_config():
    data = request.get_json()
    group = data.get("group")
    if not group:
        return jsonify({"error": "group required"}), 400

    with _lock:
        cfg = _group_configs.get(group) or {
            "enabled": False, "interval_minutes": 60, "email": "",
            "last_run": None, "next_run": None, "running": False, "last_error": None,
        }
        if "enabled" in data:
            cfg["enabled"] = bool(data["enabled"])
        if "interval_minutes" in data:
            cfg["interval_minutes"] = max(1, int(data["interval_minutes"]))
        if "email" in data:
            cfg["email"] = str(data["email"]).strip()
        _group_configs[group] = cfg

    _reschedule_group(group)
    _save_config()
    with _lock:
        return jsonify(_group_configs[group])


@bp.route("/api/monitor/alerts", methods=["GET"])
def get_alerts():
    with _lock:
        return jsonify(_alerts)


@bp.route("/api/monitor/alerts/read", methods=["POST"])
def mark_read():
    with _lock:
        for alert in _alerts:
            alert["read"] = True
    return jsonify({"status": "ok"})


@bp.route("/api/monitor/run", methods=["POST"])
def trigger_run():
    data = request.get_json()
    group = data.get("group") if data else None
    if not group:
        return jsonify({"error": "group required"}), 400
    if group not in _group_configs:
        # Allow running even without saved config — use defaults
        with _lock:
            _group_configs[group] = {
                "enabled": False, "interval_minutes": 60, "email": "",
                "last_run": None, "next_run": None, "running": False, "last_error": None,
            }
    t = threading.Thread(target=_make_job(group), daemon=True)
    t.start()
    return jsonify({"status": "triggered"})

