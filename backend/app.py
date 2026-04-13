import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

from flask import Flask, jsonify, request
from flask_cors import CORS
import boto3
import os

# Load .env file only in local development (not in Fargate)
IS_LOCAL = os.path.exists(".env")
if IS_LOCAL:
    from dotenv import load_dotenv

    load_dotenv()

# Disable SSL verification locally (corporate proxy), enable in production
VERIFY_SSL = not IS_LOCAL

app = Flask(__name__)
CORS(app)

AWS_REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")


def boto_client(service):
    return boto3.client(service, region_name=AWS_REGION, verify=VERIFY_SSL)


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/ecs")
def get_rcs_tasks():
    client = boto_client("ecs")

    clusters_response = client.list_clusters()
    clusters = clusters_response["clusterArns"]

    result = []

    for cluster_arn in clusters:
        cluster_name = cluster_arn.split("/")[-1]
        tasks_response = client.list_tasks(cluster=cluster_name)
        task_arns = tasks_response["taskArns"]

        task_count = len(task_arns)
        result.append(
            {
                "cluster": cluster_name,
                "running_tasks": task_count,
                "task_arns": task_arns,
            }
        )

    return jsonify(result)


@app.route("/api/cloudwatch/cpu")
def get_cpu_metrics():
    client = boto_client("cloudwatch")

    from datetime import datetime, timedelta

    response = client.get_metric_statistics(
        Namespace="AWS/ECS",
        MetricName="CPUUtilization",
        Dimensions=[{"Name": "ClusterName", "Value": "my-react-cluster"}],
        StartTime=datetime.utcnow() - timedelta(hours=1),
        EndTime=datetime.utcnow(),
        Period=300,
        Statistics=["Average"],
    )

    datapoints = sorted(response["Datapoints"], key=lambda x: x["Timestamp"])
    dummy = [
        {"time": "00:00", "cpu": 12.5},
        {"time": "00:05", "cpu": 18.3},
        {"time": "00:10", "cpu": 25.1},
        {"time": "00:15", "cpu": 22.7},
        {"time": "00:20", "cpu": 30.4},
        {"time": "00:25", "cpu": 28.9},
        {"time": "00:30", "cpu": 35.2},
    ]

    real = [
        {"time": dp["Timestamp"].strftime("%H:%M"), "cpu": round(dp["Average"], 2)}
        for dp in datapoints
    ]

    result = real if real else dummy
    return jsonify(result)


@app.route("/api/cloudwatch/memory")
def get_memory_metrics():
    client = boto_client("cloudwatch")

    from datetime import datetime, timedelta

    response = client.get_metric_statistics(
        Namespace="AWS/ECS",
        MetricName="MemoryUtilization",
        Dimensions=[{"Name": "ClusterName", "Value": "my-react-cluster"}],
        StartTime=datetime.utcnow() - timedelta(hours=1),
        EndTime=datetime.utcnow(),
        Period=300,
        Statistics=["Average"],
    )

    datapoints = sorted(response["Datapoints"], key=lambda x: x["Timestamp"])
    dummy = [
        {"time": "00:00", "memory": 40.2},
        {"time": "00:05", "memory": 42.5},
        {"time": "00:10", "memory": 45.1},
        {"time": "00:15", "memory": 43.8},
        {"time": "00:20", "memory": 48.3},
        {"time": "00:25", "memory": 50.1},
        {"time": "00:30", "memory": 47.6},
    ]

    real = [
        {"time": dp["Timestamp"].strftime("%H:%M"), "memory": round(dp["Average"], 2)}
        for dp in datapoints
    ]

    result = real if real else dummy

    return jsonify(result)


@app.route("/api/ec2")
def get_ec2_instances():
    client = boto_client("ec2")
    cloudwatch_client = boto_client("cloudwatch")

    from datetime import datetime, timedelta

    response = client.describe_instances()

    result = []
    for reservation in response["Reservations"]:
        for instance in reservation["Instances"]:
            instance_id = instance["InstanceId"]

            # Get instance name from tags
            name = "N/A"
            for tag in instance.get("Tags", []):
                if tag["Key"] == "Name":
                    name = tag["Value"]

            # Get CPU utilization
            cpu_response = cloudwatch_client.get_metric_statistics(
                Namespace="AWS/EC2",
                MetricName="CPUUtilization",
                Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
                StartTime=datetime.utcnow() - timedelta(hours=1),
                EndTime=datetime.utcnow(),
                Period=3600,
                Statistics=["Average"],
            )
            cpu = (
                round(cpu_response["Datapoints"][0]["Average"], 2)
                if cpu_response["Datapoints"]
                else 0
            )

            # Get status checks
            status_response = client.describe_instance_status(
                InstanceIds=[instance_id], IncludeAllInstances=True
            )
            system_status = "N/A"
            instance_status = "N/A"
            if status_response["InstanceStatuses"]:
                system_status = status_response["InstanceStatuses"][0]["SystemStatus"][
                    "Status"
                ]
                instance_status = status_response["InstanceStatuses"][0][
                    "InstanceStatus"
                ]["Status"]

            result.append(
                {
                    "instance_id": instance_id,
                    "name": name,
                    "state": instance["State"]["Name"],
                    "instance_type": instance["InstanceType"],
                    "availability_zone": instance["Placement"]["AvailabilityZone"],
                    "cpu_utilization": cpu,
                    "system_status": system_status,
                    "instance_status": instance_status,
                    "security_groups": [
                        sg["GroupId"] for sg in instance.get("SecurityGroups", [])
                    ],
                }
            )

    return jsonify(result)


@app.route("/api/action", methods=["POST"])
def execute_action():
    data = request.get_json()
    action_type = data.get("action_type")
    params = data.get("action_params", {})

    ec2_client = boto_client("ec2")
    s3_client = boto_client("s3")

    try:
        if action_type == "reboot_instance":
            response = ec2_client.reboot_instances(InstanceIds=[params["instance_id"]])
            http_status = response["ResponseMetadata"]["HTTPStatusCode"]
            if http_status == 200:
                return jsonify(
                    {
                        "status": "success",
                        "message": f"Instance {params['instance_id']} is rebooting",
                    }
                )
            return jsonify({"status": "error", "message": "Reboot request failed"}), 500

        elif action_type == "stop_instance":
            response = ec2_client.stop_instances(InstanceIds=[params["instance_id"]])
            new_state = response["StoppingInstances"][0]["CurrentState"]["Name"]
            if new_state in ["stopping", "stopped"]:
                return jsonify(
                    {
                        "status": "success",
                        "message": f"Instance {params['instance_id']} is {new_state}",
                    }
                )
            return (
                jsonify(
                    {"status": "error", "message": f"Unexpected state: {new_state}"}
                ),
                500,
            )

        elif action_type == "start_instance":
            response = ec2_client.start_instances(InstanceIds=[params["instance_id"]])
            new_state = response["StartingInstances"][0]["CurrentState"]["Name"]
            if new_state in ["pending", "running"]:
                return jsonify(
                    {
                        "status": "success",
                        "message": f"Instance {params['instance_id']} is {new_state}",
                    }
                )
            return (
                jsonify(
                    {"status": "error", "message": f"Unexpected state: {new_state}"}
                ),
                500,
            )

        elif action_type == "revoke_sg_rule":
            response = ec2_client.revoke_security_group_ingress(
                GroupId=params["group_id"],
                IpPermissions=[
                    {
                        "IpProtocol": params["protocol"],
                        "FromPort": params["port"],
                        "ToPort": params["port"],
                        "IpRanges": [{"CidrIp": params["cidr"]}],
                    }
                ],
            )
            if response.get("Return"):
                return jsonify(
                    {
                        "status": "success",
                        "message": f"Security rule revoked on {params['group_id']}",
                    }
                )
            return (
                jsonify(
                    {"status": "error", "message": "Failed to revoke security rule"}
                ),
                500,
            )

        elif action_type == "block_s3_public_access":
            s3_client.put_public_access_block(
                Bucket=params["bucket_name"],
                PublicAccessBlockConfiguration={
                    "BlockPublicAcls": True,
                    "IgnorePublicAcls": True,
                    "BlockPublicPolicy": True,
                    "RestrictPublicBuckets": True,
                },
            )
            return jsonify(
                {
                    "status": "success",
                    "message": f"Public access blocked for {params['bucket_name']}",
                }
            )

        else:
            return jsonify({"status": "error", "message": "Unknown action type"}), 400

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/alarms")
def get_cloudwatch_alarms():
    client = boto_client("cloudwatch")
    response = client.describe_alarms()

    result = []
    for alarm in response["MetricAlarms"]:
        result.append(
            {
                "name": alarm["AlarmName"],
                "state": alarm["StateValue"],
                "metric": alarm["MetricName"],
                "namespace": alarm["Namespace"],
                "threshold": alarm.get("Threshold"),
                "comparison": alarm.get("ComparisonOperator"),
                "description": alarm.get("AlarmDescription", "N/A"),
                "updated": alarm["StateUpdatedTimestamp"].strftime("%Y-%m-%d %H:%M"),
            }
        )

    return jsonify(result)


@app.route("/api/security")
def get_security_groups():
    client = boto_client("ec2")
    response = client.describe_security_groups()

    result = []
    for sg in response["SecurityGroups"]:
        risky_rules = []
        for rule in sg.get("IpPermissions", []):
            for ip_range in rule.get("IpRanges", []):
                if ip_range.get("CidrIp") == "0.0.0.0/0":
                    from_port = rule.get("FromPort", 0)
                    risky_rules.append(
                        {
                            "port": from_port,
                            "protocol": rule.get("IpProtocol"),
                            "cidr": "0.0.0.0/0",
                            "risk": (
                                "critical"
                                if from_port in [22, 3389, 1433, 3306]
                                else "warning"
                            ),
                        }
                    )

        result.append(
            {
                "group_id": sg["GroupId"],
                "name": sg["GroupName"],
                "description": sg["Description"],
                "risky_rules": risky_rules,
            }
        )

    return jsonify(result)


@app.route("/api/s3")
def get_s3_buckets():
    s3_client = boto_client("s3")
    response = s3_client.list_buckets()

    result = []
    for bucket in response["Buckets"]:
        bucket_name = bucket["Name"]

        # Check public access
        try:
            public_access = s3_client.get_public_access_block(Bucket=bucket_name)
            block_config = public_access["PublicAccessBlockConfiguration"]
            is_public = not all(
                [
                    block_config.get("BlockPublicAcls", False),
                    block_config.get("BlockPublicPolicy", False),
                    block_config.get("IgnorePublicAcls", False),
                    block_config.get("RestrictPublicBuckets", False),
                ]
            )
        except:
            is_public = True

        result.append(
            {
                "name": bucket_name,
                "created": bucket["CreationDate"].strftime("%Y-%m-%d"),
                "is_public": is_public,
            }
        )

    return jsonify(result)


@app.route("/api/logs")
def get_log_groups():
    import time
    from datetime import datetime

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
        error_count = 0
        warning_count = 0

        try:
            error_resp = client.filter_log_events(
                logGroupName=group_name,
                startTime=now_ms - one_hour_ms,
                endTime=now_ms,
                filterPattern='"ERROR"',
                limit=100,
            )
            error_count = len(error_resp.get("events", []))
        except Exception:
            pass

        try:
            warn_resp = client.filter_log_events(
                logGroupName=group_name,
                startTime=now_ms - one_hour_ms,
                endTime=now_ms,
                filterPattern='"WARN"',
                limit=100,
            )
            warning_count = len(warn_resp.get("events", []))
        except Exception:
            pass

        if error_count > 5:
            health = "critical"
        elif error_count > 0 or warning_count > 0:
            health = "warning"
        else:
            health = "healthy"

        stored_bytes = group.get("storedBytes", 0)
        if stored_bytes >= 1_073_741_824:
            stored_str = f"{round(stored_bytes / 1_073_741_824, 1)} GB"
        elif stored_bytes >= 1_048_576:
            stored_str = f"{round(stored_bytes / 1_048_576, 1)} MB"
        elif stored_bytes >= 1024:
            stored_str = f"{round(stored_bytes / 1024, 1)} KB"
        else:
            stored_str = f"{stored_bytes} B"

        result.append({
            "name": group_name,
            "stored_bytes": stored_bytes,
            "stored_str": stored_str,
            "retention_days": group.get("retentionInDays", "Never"),
            "error_count": error_count,
            "warning_count": warning_count,
            "health": health,
            "created": datetime.fromtimestamp(group["creationTime"] / 1000).strftime("%Y-%m-%d"),
        })

    return jsonify(result)


@app.route("/api/logs/events")
def get_log_events():
    import time
    from datetime import datetime

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
    error_count = 0
    warning_count = 0
    result = []

    for event in sorted(events, key=lambda e: e["timestamp"], reverse=True):
        message = event.get("message", "").strip()
        upper = message.upper()
        if any(kw in upper for kw in ("ERROR", "EXCEPTION", "FATAL", "CRITICAL")):
            level = "ERROR"
            error_count += 1
        elif "WARN" in upper:
            level = "WARN"
            warning_count += 1
        else:
            level = "INFO"

        result.append({
            "timestamp": datetime.fromtimestamp(event["timestamp"] / 1000).strftime("%Y-%m-%d %H:%M:%S"),
            "message": message,
            "stream": event.get("logStreamName", ""),
            "level": level,
        })

    return jsonify({
        "group": group_name,
        "events": result,
        "total": len(result),
        "error_count": error_count,
        "warning_count": warning_count,
        "info_count": len(result) - error_count - warning_count,
        "hours": hours,
    })


@app.route("/api/insights", methods=["POST"])
def get_insights():
    import json

    data = request.get_json()
    service = data.get("service")
    payload = data.get("data")

    service_prompts = {
        "ec2": "EC2 instances. Possible action_types: reboot_instance, stop_instance, start_instance, revoke_sg_rule, none",
        "alarms": "CloudWatch alarms. Possible action_types: none",
        "security": "Security Groups. Possible action_types: revoke_sg_rule, none. Include group_id, protocol, port, cidr in action_params",
        "s3": "S3 buckets. Possible action_types: ONLY use 'block_s3_public_access' for public buckets, or 'none'. Include bucket_name in action_params when using block_s3_public_access",
        "ecs": "ECS clusters and tasks. Possible action_types: none",
        "cloudwatch": "CloudWatch log events from a specific log group. Focus on error patterns, recurring failures, and anomalies. Possible action_types: none",
    }

    service_description = service_prompts.get(service, "AWS infrastructure")

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

    bedrock_client = boto_client("bedrock-runtime")

    # For cloudwatch, only send errors/warnings (max 20) to stay within token limits
    if service == "cloudwatch" and isinstance(payload, list):
        payload = [e for e in payload if e.get("level") in ("ERROR", "WARN")][:20]

    response = bedrock_client.invoke_model(
        modelId="meta.llama3-8b-instruct-v1:0",
        body=json.dumps(
            {
                "prompt": f"<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n{prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>",
                "max_gen_len": 2048,
                "temperature": 0.1,
            }
        ),
    )
    response_body = json.loads(response["body"].read())
    raw = response_body["generation"].strip()

    # Strip markdown code fences if the model wrapped the JSON
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    # Find the JSON array boundaries in case of any preamble text
    start = raw.find("[")
    end = raw.rfind("]")
    if start != -1 and end != -1:
        raw = raw[start:end + 1]

    insights = json.loads(raw)
    return jsonify(insights)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
