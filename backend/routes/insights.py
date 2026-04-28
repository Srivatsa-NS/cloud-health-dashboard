import json
import hashlib
import time
from flask import Blueprint, jsonify, request
from config import boto_client

bp = Blueprint("insights", __name__)

_cache = {}
_CACHE_TTL = 300  # 5 minutes

MODEL_ID = "amazon.nova-lite-v1:0"

_SERVICE_CONTEXT = {
    "ec2": "EC2 instances",
    "alarms": "CloudWatch alarms",
    "security": "Security Groups",
    "s3": "S3 buckets",
    "ecs": "ECS clusters and tasks",
    "cloudwatch": "CloudWatch log events from a specific log group — focus on error patterns, recurring failures, and anomalies",
}

# Single tool the model is forced to call — guarantees structured output
_INSIGHT_TOOL = {
    "toolSpec": {
        "name": "report_insights",
        "description": "Report security and operational insights found in the resource data.",
        "inputSchema": {
            "json": {
                "type": "object",
                "properties": {
                    "insights": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "severity": {
                                    "type": "string",
                                    "enum": ["critical", "warning", "info"],
                                },
                                "title": {"type": "string"},
                                "description": {"type": "string"},
                                "action": {"type": "string"},
                                "action_type": {
                                    "type": "string",
                                    "enum": [
                                        "reboot_instance",
                                        "stop_instance",
                                        "start_instance",
                                        "revoke_sg_rule",
                                        "block_s3_public_access",
                                        "none",
                                    ],
                                },
                                "action_params": {"type": "object"},
                            },
                            "required": [
                                "severity",
                                "title",
                                "description",
                                "action",
                                "action_type",
                                "action_params",
                            ],
                        },
                    }
                },
                "required": ["insights"],
            }
        },
    }
}

# One tool per executable action — used by /api/chat-action
_ACTION_TOOLS = [
    {
        "toolSpec": {
            "name": "reboot_instance",
            "description": "Reboot an EC2 instance.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "instance_id": {"type": "string"},
                        "what_will_happen": {
                            "type": "string",
                            "description": "One plain-English sentence describing exactly what will happen",
                        },
                    },
                    "required": ["instance_id", "what_will_happen"],
                }
            },
        }
    },
    {
        "toolSpec": {
            "name": "stop_instance",
            "description": "Stop (power off) an EC2 instance.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "instance_id": {"type": "string"},
                        "what_will_happen": {"type": "string"},
                    },
                    "required": ["instance_id", "what_will_happen"],
                }
            },
        }
    },
    {
        "toolSpec": {
            "name": "start_instance",
            "description": "Start (power on) a stopped EC2 instance.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "instance_id": {"type": "string"},
                        "what_will_happen": {"type": "string"},
                    },
                    "required": ["instance_id", "what_will_happen"],
                }
            },
        }
    },
    {
        "toolSpec": {
            "name": "revoke_sg_rule",
            "description": "Remove (revoke) an inbound security group rule to block access.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "group_id": {"type": "string"},
                        "protocol": {"type": "string"},
                        "port": {"type": "integer"},
                        "cidr": {"type": "string"},
                        "what_will_happen": {"type": "string"},
                    },
                    "required": [
                        "group_id",
                        "protocol",
                        "port",
                        "cidr",
                        "what_will_happen",
                    ],
                }
            },
        }
    },
    {
        "toolSpec": {
            "name": "block_s3_public_access",
            "description": "Enable Block Public Access on an S3 bucket to make it private.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "bucket_name": {"type": "string"},
                        "what_will_happen": {"type": "string"},
                    },
                    "required": ["bucket_name", "what_will_happen"],
                }
            },
        }
    },
]


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

    service_context = _SERVICE_CONTEXT.get(service, "AWS infrastructure")
    bedrock = boto_client("bedrock-runtime")
    response = bedrock.converse(
        modelId=MODEL_ID,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "text": (
                            f"You are a cloud infrastructure and security expert. "
                            f"Analyze the following {service_context} data and call the report_insights tool "
                            f"with every issue you find. For action_params, use only exact real values from the "
                            f"data — never placeholders or example values.\n\nData:\n{json.dumps(payload, indent=2)}"
                        )
                    }
                ],
            }
        ],
        toolConfig={
            "tools": [_INSIGHT_TOOL],
            "toolChoice": {"tool": {"name": "report_insights"}},
        },
    )

    tool_input = next(
        block["toolUse"]["input"]
        for block in response["output"]["message"]["content"]
        if "toolUse" in block
    )
    insights = tool_input["insights"]

    _cache[cache_key] = {"insights": insights, "cached_at": now}
    stale = [k for k, v in _cache.items() if (now - v["cached_at"]) >= _CACHE_TTL]
    for k in stale:
        del _cache[k]
    return jsonify(insights)


@bp.route("/api/chat-action", methods=["POST"])
def chat_action():
    data = request.get_json()
    instruction = (data.get("instruction") or "").strip()
    resource_data = data.get("resource_data", {})

    if not instruction:
        return jsonify({"error": "instruction is required"}), 400

    bedrock = boto_client("bedrock-runtime")
    response = bedrock.converse(
        modelId=MODEL_ID,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "text": (
                            f"You are a cloud infrastructure assistant. The user wants to take an action on their AWS resource.\n\n"
                            f"Resource data:\n{json.dumps(resource_data, indent=2)}\n\n"
                            f"User instruction: {instruction}\n\n"
                            f"Call the most appropriate tool to fulfill this request. "
                            f"Use only real values from the resource data — never placeholders. "
                            f"Set what_will_happen to a plain-English sentence describing exactly what will execute."
                        )
                    }
                ],
            }
        ],
        toolConfig={
            "tools": _ACTION_TOOLS,
            "toolChoice": {"auto": {}},
        },
    )

    tool_use = next(
        (
            block["toolUse"]
            for block in response["output"]["message"]["content"]
            if "toolUse" in block
        ),
        None,
    )

    if tool_use is None:
        return (
            jsonify(
                {
                    "error": "The AI could not determine an appropriate action for that instruction."
                }
            ),
            422,
        )

    action_type = tool_use["name"]
    action_params = dict(tool_use["input"])
    what_will_happen = action_params.pop("what_will_happen", "")

    return jsonify(
        {
            "action_type": action_type,
            "action_params": action_params,
            "what_will_happen": what_will_happen,
        }
    )
