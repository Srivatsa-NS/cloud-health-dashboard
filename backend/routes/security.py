from flask import Blueprint, jsonify
from config import boto_client

bp = Blueprint("security", __name__)


@bp.route("/api/security")
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
                    risky_rules.append({
                        "port": from_port,
                        "protocol": rule.get("IpProtocol"),
                        "cidr": "0.0.0.0/0",
                        "risk": "critical" if from_port in [22, 3389, 1433, 3306] else "warning",
                    })
        result.append({
            "group_id": sg["GroupId"],
            "name": sg["GroupName"],
            "description": sg["Description"],
            "risky_rules": risky_rules,
        })

    return jsonify(result)
