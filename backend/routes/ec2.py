from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request
from config import boto_client

bp = Blueprint("ec2", __name__)


@bp.route("/api/ec2")
def get_ec2_instances():
    client = boto_client("ec2")
    cloudwatch_client = boto_client("cloudwatch")
    response = client.describe_instances()

    result = []
    for reservation in response["Reservations"]:
        for instance in reservation["Instances"]:
            instance_id = instance["InstanceId"]

            name = next(
                (tag["Value"] for tag in instance.get("Tags", []) if tag["Key"] == "Name"),
                "N/A",
            )

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
                if cpu_response["Datapoints"] else 0
            )

            status_response = client.describe_instance_status(
                InstanceIds=[instance_id], IncludeAllInstances=True
            )
            system_status = instance_status = "N/A"
            if status_response["InstanceStatuses"]:
                system_status = status_response["InstanceStatuses"][0]["SystemStatus"]["Status"]
                instance_status = status_response["InstanceStatuses"][0]["InstanceStatus"]["Status"]

            result.append({
                "instance_id": instance_id,
                "name": name,
                "state": instance["State"]["Name"],
                "instance_type": instance["InstanceType"],
                "availability_zone": instance["Placement"]["AvailabilityZone"],
                "cpu_utilization": cpu,
                "system_status": system_status,
                "instance_status": instance_status,
                "security_groups": [sg["GroupId"] for sg in instance.get("SecurityGroups", [])],
            })

    return jsonify(result)


@bp.route("/api/action", methods=["POST"])
def execute_action():
    data = request.get_json()
    action_type = data.get("action_type")
    params = data.get("action_params", {})

    ec2_client = boto_client("ec2")
    s3_client = boto_client("s3")

    try:
        if action_type == "reboot_instance":
            response = ec2_client.reboot_instances(InstanceIds=[params["instance_id"]])
            if response["ResponseMetadata"]["HTTPStatusCode"] == 200:
                return jsonify({"status": "success", "message": f"Instance {params['instance_id']} is rebooting"})
            return jsonify({"status": "error", "message": "Reboot request failed"}), 500

        elif action_type == "stop_instance":
            response = ec2_client.stop_instances(InstanceIds=[params["instance_id"]])
            new_state = response["StoppingInstances"][0]["CurrentState"]["Name"]
            if new_state in ["stopping", "stopped"]:
                return jsonify({"status": "success", "message": f"Instance {params['instance_id']} is {new_state}"})
            return jsonify({"status": "error", "message": f"Unexpected state: {new_state}"}), 500

        elif action_type == "start_instance":
            response = ec2_client.start_instances(InstanceIds=[params["instance_id"]])
            new_state = response["StartingInstances"][0]["CurrentState"]["Name"]
            if new_state in ["pending", "running"]:
                return jsonify({"status": "success", "message": f"Instance {params['instance_id']} is {new_state}"})
            return jsonify({"status": "error", "message": f"Unexpected state: {new_state}"}), 500

        elif action_type == "revoke_sg_rule":
            response = ec2_client.revoke_security_group_ingress(
                GroupId=params["group_id"],
                IpPermissions=[{
                    "IpProtocol": params["protocol"],
                    "FromPort": params["port"],
                    "ToPort": params["port"],
                    "IpRanges": [{"CidrIp": params["cidr"]}],
                }],
            )
            if response.get("Return"):
                return jsonify({"status": "success", "message": f"Security rule revoked on {params['group_id']}"})
            return jsonify({"status": "error", "message": "Failed to revoke security rule"}), 500

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
            return jsonify({"status": "success", "message": f"Public access blocked for {params['bucket_name']}"})

        else:
            return jsonify({"status": "error", "message": "Unknown action type"}), 400

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
