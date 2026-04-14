from flask import Blueprint, jsonify
from config import boto_client

bp = Blueprint("alarms", __name__)


@bp.route("/api/alarms")
def get_cloudwatch_alarms():
    client = boto_client("cloudwatch")
    response = client.describe_alarms()

    result = [
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
        for alarm in response["MetricAlarms"]
    ]
    return jsonify(result)
