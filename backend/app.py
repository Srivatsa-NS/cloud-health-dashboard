import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

from flask import Flask, jsonify, request
from flask_cors import CORS
import boto3
import os

# Load .env file only in local development (not in Fargate)
if os.path.exists(".env"):
    from dotenv import load_dotenv

    load_dotenv()

app = Flask(__name__)
CORS(app)

AWS_REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/ecs")
def get_rcs_tasks():
    client = boto3.client(
        "ecs",
        region_name=AWS_REGION,
        # aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        # aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        # verify=False
    )

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
    client = boto3.client(
        "cloudwatch",
        region_name=AWS_REGION,
        # aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        # aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        # verify=False
    )

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
    client = boto3.client(
        "cloudwatch",
        region_name=AWS_REGION,
        # aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        # aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        # verify=False
    )

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
    client = boto3.client("ec2", region_name=AWS_REGION)
    cloudwatch_client = boto3.client("cloudwatch", region_name=AWS_REGION)

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

    ec2_client = boto3.client("ec2", region_name=AWS_REGION)
    s3_client = boto3.client("s3", region_name=AWS_REGION)

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
    client = boto3.client("cloudwatch", region_name=AWS_REGION)
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
    client = boto3.client("ec2", region_name=AWS_REGION)
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
    s3_client = boto3.client("s3", region_name=AWS_REGION)
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

    bedrock_client = boto3.client("bedrock-runtime", region_name=AWS_REGION)
    response = bedrock_client.invoke_model(
        modelId="meta.llama3-8b-instruct-v1:0",
        body=json.dumps(
            {
                "prompt": f"<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n{prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>",
                "max_gen_len": 1024,
                "temperature": 0.1,
            }
        ),
    )
    response_body = json.loads(response["body"].read())
    insights = json.loads(response_body["generation"])
    return jsonify(insights)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
