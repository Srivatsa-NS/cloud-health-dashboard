import json
import hashlib
import time
from flask import Blueprint, jsonify, request
from config import boto_client

bp = Blueprint("insights", __name__)

_cache = {}
_CACHE_TTL = 300  # 5 minutes

_SERVICE_PROMPTS = {
    "ec2": "EC2 instances. Possible action_types: reboot_instance, stop_instance, start_instance, revoke_sg_rule, none",
    "alarms": "CloudWatch alarms. Possible action_types: none",
    "security": "Security Groups. Possible action_types: revoke_sg_rule, none. Include group_id, protocol, port, cidr in action_params",
    "s3": "S3 buckets. Possible action_types: ONLY use 'block_s3_public_access' for public buckets, or 'none'. Include bucket_name in action_params when using block_s3_public_access",
    "ecs": "ECS clusters and tasks. Possible action_types: none",
    "cloudwatch": "CloudWatch log events from a specific log group. Focus on error patterns, recurring failures, and anomalies. Possible action_types: none",
}


def _parse_bedrock_json(raw):
    """Strip markdown fences and extract the first JSON array from a Bedrock response."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    start, end = raw.find("["), raw.rfind("]")
    if start != -1 and end != -1:
        return json.loads(raw[start:end + 1])
    raise ValueError("No JSON array found in response")


@bp.route("/api/insights", methods=["POST"])
def get_insights():
    data = request.get_json()
    service = data.get("service")
    payload = data.get("data")

    cache_key = hashlib.sha256(
        f"{service}:{json.dumps(payload, sort_keys=True)}".encode()
    ).hexdigest()

    now = time.time()
    cached = _cache.get(cache_key)
    if cached and (now - cached["cached_at"]) < _CACHE_TTL:
        return jsonify(cached["insights"])

    service_description = _SERVICE_PROMPTS.get(service, "AWS infrastructure")
    prompt = f"""You are a cloud infrastructure and security expert. Analyze the following {service_description} data and provide actionable insights.

Data:
{json.dumps(payload, indent=2)}

Respond with a JSON array of insights. Each insight must have:
- "severity": "critical", "warning", or "info"
- "title": short title
- "description": what the issue is and why it matters
- "action": what to do to fix it
- "action_type": the appropriate action type from the list above
- "action_params": parameters needed to execute the action

Only respond with the JSON array, no other text."""

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
    insights = _parse_bedrock_json(raw)

    _cache[cache_key] = {"insights": insights, "cached_at": now}
    return jsonify(insights)
