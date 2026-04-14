from flask import Blueprint, jsonify
from config import boto_client

bp = Blueprint("s3", __name__)


@bp.route("/api/s3")
def get_s3_buckets():
    s3_client = boto_client("s3")
    response = s3_client.list_buckets()

    result = []
    for bucket in response["Buckets"]:
        bucket_name = bucket["Name"]
        try:
            public_access = s3_client.get_public_access_block(Bucket=bucket_name)
            cfg = public_access["PublicAccessBlockConfiguration"]
            is_public = not all([
                cfg.get("BlockPublicAcls", False),
                cfg.get("BlockPublicPolicy", False),
                cfg.get("IgnorePublicAcls", False),
                cfg.get("RestrictPublicBuckets", False),
            ])
        except Exception:
            is_public = True

        result.append({
            "name": bucket_name,
            "created": bucket["CreationDate"].strftime("%Y-%m-%d"),
            "is_public": is_public,
        })

    return jsonify(result)
