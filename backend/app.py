import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

from flask import Flask, jsonify
from flask_cors import CORS
import boto3
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)
CORS(app)

AWS_REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-1")

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
        result.append({
            "cluster" : cluster_name,
            "running_tasks" : task_count,
            "task_arns" : task_arns
        })
        
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
        Dimensions=[
            {
                "Name" : "ClusterName",
                "Value" : "my-react-cluster"
            }
        ],
        StartTime=datetime.utcnow() - timedelta(hours=1),
        EndTime=datetime.utcnow(),
        Period=300,
        Statistics=["Average"]
    )
    
    datapoints = sorted(response["Datapoints"], key=lambda x : x["Timestamp"])
    dummy = [
        {"time": "00:00", "cpu": 12.5},
        {"time": "00:05", "cpu": 18.3},
        {"time": "00:10", "cpu": 25.1},
        {"time": "00:15", "cpu": 22.7},
        {"time": "00:20", "cpu": 30.4},
        {"time": "00:25", "cpu": 28.9},
        {"time": "00:30", "cpu": 35.2}
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
        Dimensions=[
            {"Name": "ClusterName", "Value": "my-react-cluster"}
        ],
        StartTime=datetime.utcnow() - timedelta(hours=1),
        EndTime=datetime.utcnow(),
        Period=300,
        Statistics=["Average"]
    )
    
    datapoints = sorted(response["Datapoints"], key=lambda x: x["Timestamp"])
    dummy = [
        {"time": "00:00", "memory": 40.2},
        {"time": "00:05", "memory": 42.5},
        {"time": "00:10", "memory": 45.1},
        {"time": "00:15", "memory": 43.8},
        {"time": "00:20", "memory": 48.3},
        {"time": "00:25", "memory": 50.1},
        {"time": "00:30", "memory": 47.6}
    ]
    
    real = [
        {"time": dp["Timestamp"].strftime("%H:%M"), "memory": round(dp["Average"], 2)}
        for dp in datapoints
    ]
    
    result = real if real else dummy
    
    return jsonify(result)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)