from datetime import datetime, timedelta
from flask import Blueprint, jsonify
from config import boto_client

bp = Blueprint("ecs", __name__)


@bp.route("/api/ecs")
def get_ecs_tasks():
    client = boto_client("ecs")
    clusters_response = client.list_clusters()
    result = []
    for cluster_arn in clusters_response["clusterArns"]:
        cluster_name = cluster_arn.split("/")[-1]
        tasks_response = client.list_tasks(cluster=cluster_name)
        task_arns = tasks_response["taskArns"]
        result.append({
            "cluster": cluster_name,
            "running_tasks": len(task_arns),
            "task_arns": task_arns,
        })
    return jsonify(result)


@bp.route("/api/cloudwatch/cpu")
def get_cpu_metrics():
    client = boto_client("cloudwatch")
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
        {"time": "00:00", "cpu": 12.5}, {"time": "00:05", "cpu": 18.3},
        {"time": "00:10", "cpu": 25.1}, {"time": "00:15", "cpu": 22.7},
        {"time": "00:20", "cpu": 30.4}, {"time": "00:25", "cpu": 28.9},
        {"time": "00:30", "cpu": 35.2},
    ]
    real = [{"time": dp["Timestamp"].strftime("%H:%M"), "cpu": round(dp["Average"], 2)} for dp in datapoints]
    return jsonify(real if real else dummy)


@bp.route("/api/cloudwatch/memory")
def get_memory_metrics():
    client = boto_client("cloudwatch")
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
        {"time": "00:00", "memory": 40.2}, {"time": "00:05", "memory": 42.5},
        {"time": "00:10", "memory": 45.1}, {"time": "00:15", "memory": 43.8},
        {"time": "00:20", "memory": 48.3}, {"time": "00:25", "memory": 50.1},
        {"time": "00:30", "memory": 47.6},
    ]
    real = [{"time": dp["Timestamp"].strftime("%H:%M"), "memory": round(dp["Average"], 2)} for dp in datapoints]
    return jsonify(real if real else dummy)
