import json
import re
import time
import threading
from pathlib import Path
from flask import Blueprint, jsonify, request
from apscheduler.schedulers.background import BackgroundScheduler
from config import boto_client, SENDER_EMAIL

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
                # Migrate old single-email field to list
                if "email" in cfg and "emails" not in cfg:
                    old = cfg.pop("email")
                    cfg["emails"] = [old] if old else []
                elif "emails" not in cfg:
                    cfg["emails"] = []
                # Defaults for fields added in later versions
                cfg.setdefault("min_severity", "warning")
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
                emails        = list(_group_configs[group_name].get("emails", []))
                min_severity  = _group_configs[group_name].get("min_severity", "warning")

            logs_client = boto_client("logs")
            now_ms = int(time.time() * 1000)

            with _lock:
                last_run = _group_configs[group_name].get("last_run")
            if last_run:
                start_ms = int(last_run * 1000)
            else:
                start_ms = now_ms - interval_minutes * 60 * 1000

            resp = logs_client.filter_log_events(
                logGroupName=group_name,
                startTime=start_ms,
                endTime=now_ms,
                limit=500,
            )
            events = resp.get("events", [])

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

            # Build 1 INFO summary item unconditionally — always fires so the
            # full pipeline (scheduler → email → toaster) is testable.
            if not events:
                info_summary = (
                    f"No log events found in the last {interval_minutes} min. "
                    "The log group is quiet or has no recent activity."
                )
            else:
                info_bucket = sorted(
                    [v for v in templates.values() if v["level"] == "INFO"],
                    key=lambda x: x["count"], reverse=True,
                )
                if info_bucket:
                    top = info_bucket[0]
                    info_summary = (
                        f"{len(events)} events scanned in the last {interval_minutes} min. "
                        f"Most frequent pattern ({top['count']}×): \"{top['sample'][:120]}\""
                    )
                else:
                    error_count = sum(1 for v in templates.values() if v["level"] == "ERROR")
                    warn_count  = sum(1 for v in templates.values() if v["level"] == "WARN")
                    info_summary = (
                        f"{len(events)} events scanned in the last {interval_minutes} min "
                        f"({error_count} error pattern(s), {warn_count} warning pattern(s))."
                    )
            info_issue = {
                "severity": "info",
                "title": "Log activity summary",
                "description": info_summary,
                "action": "Informational only — no action required.",
            }

            # Run Bedrock analysis only when there are errors/warnings
            issues = []
            if events and any(p["level"] in ("ERROR", "WARN") for p in payload):
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

            window_minutes_actual = round((now_ms - start_ms) / 60_000, 1)
            new_alert = {
                "id": f"{int(time.time())}-{group_name}",
                "group": group_name,
                "issues": issues,
                "window_minutes": window_minutes_actual,
                "raw_event_count": len(events),
                "timestamp": time.time(),
                "read": False,
                "acknowledged": False,
            }
            with _lock:
                _alerts.insert(0, new_alert)
                del _alerts[50:]
            if emails:
                failures = []
                for em in emails:
                    err = _send_email(em, new_alert, min_severity)
                    if err:
                        failures.append(f"{em}: {err}")
                if failures:
                    with _lock:
                        if group_name in _group_configs:
                            _group_configs[group_name]["last_error"] = "Email failed: " + "; ".join(failures)

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
            max_instances=1,
            misfire_grace_time=cfg["interval_minutes"] * 60,
            coalesce=True,
        )
        _group_configs[group_name]["next_run"] = time.time() + cfg["interval_minutes"] * 60
    else:
        if cfg:
            cfg["next_run"] = None


def _send_email(to_email, alert, min_severity="warning"):
    """Send alert email via SES. Returns None on success, error string on failure."""
    ses = boto_client("ses")
    group_name = alert["group"]
    from_address = SENDER_EMAIL if SENDER_EMAIL else to_email

    # Determine which severities qualify for an email
    allowed = {"CRITICAL"} if min_severity == "critical" else {"CRITICAL", "WARNING"}

    # Build plain-text body
    lines = [
        f"CloudPulse Monitor Alert",
        f"========================",
        f"Log Group : {group_name}",
        f"Window    : last {alert['window_minutes']} minutes",
        f"Events    : {alert['raw_event_count']} total",
        f"Time      : {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime(alert['timestamp']))}",
        "",
    ]
    has_issues = False
    for issue in alert.get("issues", []):
        severity = issue.get("severity", "").upper()
        if severity in allowed:
            has_issues = True
            lines += [
                f"[{severity}] {issue.get('title', '')}",
                f"  What's happening: {issue.get('description', '')}",
                f"  Recommended action: {issue.get('action', '')}",
                "",
            ]

    # If nothing meets the threshold, don't send
    if not has_issues:
        return None

    subject = f"CloudPulse 🚨 {group_name} — issues detected"

    try:
        ses.send_email(
            Source=f"CloudPulse Alerts <{from_address}>",
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject},
                "Body": {"Text": {"Data": "\n".join(lines)}},
            },
        )
        return None  # success
    except Exception as e:
        return str(e)  # return error so caller can surface it


def _get_email_verification_statuses(emails):
    """Returns {email: 'verified'|'pending'|'unverified'} for each email."""
    if not emails:
        return {}
    try:
        ses = boto_client("ses")
        resp = ses.get_identity_verification_attributes(Identities=emails)
        result = {}
        for em in emails:
            status = resp["VerificationAttributes"].get(em, {}).get("VerificationStatus", "")
            if status == "Success":
                result[em] = "verified"
            elif status in ("Pending", "TemporaryFailure"):
                result[em] = "pending"
            else:
                result[em] = "unverified"
        return result
    except Exception:
        return {em: "unknown" for em in emails}


def _trigger_email_verifications(emails):
    """Triggers SES verification for each email. Returns list of (email, error) for failures."""
    ses = boto_client("ses")
    failures = []
    for em in emails:
        try:
            ses.verify_email_identity(EmailAddress=em)
        except Exception as e:
            failures.append((em, str(e)))
    return failures


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

@bp.route("/api/monitor/config", methods=["GET"])
def get_group_config():
    group = request.args.get("group")
    if not group:
        return jsonify({"error": "group parameter required"}), 400
    with _lock:
        cfg = dict(_group_configs.get(group) or {
            "enabled": False, "interval_minutes": 60, "emails": [],
            "min_severity": "warning",
            "last_run": None, "next_run": None, "running": False, "last_error": None,
        })
    # Check SES verification status outside the lock (network call)
    cfg["email_statuses"] = _get_email_verification_statuses(cfg.get("emails", []))
    return jsonify(cfg)


@bp.route("/api/monitor/config", methods=["POST"])
def update_group_config():
    data = request.get_json()
    group = data.get("group")
    if not group:
        return jsonify({"error": "group required"}), 400

    with _lock:
        cfg = _group_configs.get(group) or {
            "enabled": False, "interval_minutes": 60, "emails": [],
            "last_run": None, "next_run": None, "running": False, "last_error": None,
        }
        if "enabled" in data:
            cfg["enabled"] = bool(data["enabled"])
        if "interval_minutes" in data:
            cfg["interval_minutes"] = max(1, int(data["interval_minutes"]))
        if "min_severity" in data:
            cfg["min_severity"] = "critical" if data["min_severity"] == "critical" else "warning"
        old_emails = set(cfg.get("emails", []))
        if "emails" in data:
            cfg["emails"] = [str(e).strip() for e in data["emails"] if str(e).strip()]
        _group_configs[group] = cfg
        new_emails = list(cfg["emails"])

    _reschedule_group(group)
    _save_config()

    # Trigger verification for any newly added emails
    force_verify = bool(data.get("force_verify", False))
    added = [em for em in new_emails if em not in old_emails] if not force_verify else new_emails
    if added:
        _trigger_email_verifications(added)

    with _lock:
        response = dict(_group_configs[group])
    response["email_statuses"] = _get_email_verification_statuses(new_emails)
    return jsonify(response)


@bp.route("/api/monitor/alerts", methods=["GET"])
def get_alerts():
    with _lock:
        return jsonify(_alerts)


@bp.route("/api/monitor/config", methods=["DELETE"])
def delete_group_config():
    group = request.args.get("group")
    if not group:
        return jsonify({"error": "group parameter required"}), 400
    job_id = f"monitor-{group}"
    if _scheduler.get_job(job_id):
        _scheduler.remove_job(job_id)
    with _lock:
        _group_configs.pop(group, None)
    _save_config()
    return jsonify({"status": "deleted"})


@bp.route("/api/monitor/alerts/read", methods=["POST"])
def mark_read():
    with _lock:
        for alert in _alerts:
            alert["read"] = True
    return jsonify({"status": "ok"})


@bp.route("/api/monitor/alerts/acknowledge", methods=["POST"])
def acknowledge_alert():
    data = request.get_json()
    alert_id = data.get("id") if data else None
    if not alert_id:
        return jsonify({"error": "id required"}), 400
    with _lock:
        for alert in _alerts:
            if alert["id"] == alert_id:
                alert["acknowledged"] = True
                alert["read"] = True
                break
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
                "enabled": False, "interval_minutes": 60, "emails": [],
                "min_severity": "warning",
                "last_run": None, "next_run": None, "running": False, "last_error": None,
            }
    t = threading.Thread(target=_make_job(group), daemon=True)
    t.start()
    return jsonify({"status": "triggered"})

