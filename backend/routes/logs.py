import time
from datetime import datetime
from flask import Blueprint, jsonify, request
from config import boto_client

bp = Blueprint("logs", __name__)

_ERROR_KEYWORDS = ("ERROR", "EXCEPTION", "FATAL", "CRITICAL")


def _classify_level(message):
    upper = message.upper()
    if any(kw in upper for kw in _ERROR_KEYWORDS):
        return "ERROR"
    elif "WARN" in upper:
        return "WARN"
    return "INFO"


def _format_bytes(n):
    if n >= 1_073_741_824:
        return f"{round(n / 1_073_741_824, 1)} GB"
    elif n >= 1_048_576:
        return f"{round(n / 1_048_576, 1)} MB"
    elif n >= 1024:
        return f"{round(n / 1024, 1)} KB"
    return f"{n} B"


@bp.route("/api/logs")
def get_log_groups():
    client = boto_client("logs")
    now_ms = int(time.time() * 1000)
    one_hour_ms = 60 * 60 * 1000

    all_groups = []
    try:
        paginator = client.get_paginator("describe_log_groups")
        for page in paginator.paginate():
            all_groups.extend(page["logGroups"])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    result = []
    for group in all_groups:
        group_name = group["logGroupName"]
        error_count = warning_count = 0

        try:
            events_resp = client.filter_log_events(
                logGroupName=group_name,
                startTime=now_ms - one_hour_ms,
                endTime=now_ms,
                limit=500,
            )
            for event in events_resp.get("events", []):
                level = _classify_level(event.get("message", ""))
                if level == "ERROR":
                    error_count += 1
                elif level == "WARN":
                    warning_count += 1
        except Exception:
            pass

        if error_count > 5:
            health = "critical"
        elif error_count > 0 or warning_count > 0:
            health = "warning"
        else:
            health = "healthy"

        stored_bytes = group.get("storedBytes", 0)
        result.append({
            "name": group_name,
            "stored_bytes": stored_bytes,
            "stored_str": _format_bytes(stored_bytes),
            "retention_days": group.get("retentionInDays", "Never"),
            "error_count": error_count,
            "warning_count": warning_count,
            "health": health,
            "created": datetime.fromtimestamp(group["creationTime"] / 1000).strftime("%Y-%m-%d"),
        })

    return jsonify(result)


@bp.route("/api/logs/events")
def get_log_events():
    group_name = request.args.get("group")
    if not group_name:
        return jsonify({"error": "group parameter required"}), 400

    hours = int(request.args.get("hours", 1))
    client = boto_client("logs")
    now_ms = int(time.time() * 1000)
    window_ms = hours * 60 * 60 * 1000

    try:
        response = client.filter_log_events(
            logGroupName=group_name,
            startTime=now_ms - window_ms,
            endTime=now_ms,
            limit=500,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    events = response.get("events", [])
    error_count = warning_count = 0
    result = []
    pattern_counts = {}

    for event in sorted(events, key=lambda e: e["timestamp"], reverse=True):
        message = event.get("message", "").strip()
        level = _classify_level(message)

        if level == "ERROR":
            error_count += 1
        elif level == "WARN":
            warning_count += 1

        result.append({
            "timestamp": datetime.fromtimestamp(event["timestamp"] / 1000).strftime("%Y-%m-%d %H:%M:%S"),
            "message": message,
            "stream": event.get("logStreamName", ""),
            "level": level,
        })

        key = message[:120]
        if key in pattern_counts:
            pattern_counts[key]["count"] += 1
        else:
            pattern_counts[key] = {"message": message[:200], "level": level, "count": 1}

    # Priority payload: 15 ERROR + 10 WARN + 5 INFO = 30 max
    insights_payload = []
    for level_name, limit in [("ERROR", 15), ("WARN", 10), ("INFO", 5)]:
        bucket = sorted(
            [p for p in pattern_counts.values() if p["level"] == level_name],
            key=lambda x: x["count"], reverse=True,
        )[:limit]
        insights_payload.extend(bucket)

    return jsonify({
        "group": group_name,
        "events": result,
        "total": len(result),
        "error_count": error_count,
        "warning_count": warning_count,
        "info_count": len(result) - error_count - warning_count,
        "hours": hours,
        "top_errors": insights_payload,
    })
