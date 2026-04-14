import os
import boto3

IS_LOCAL = os.path.exists(".env")
if IS_LOCAL:
    from dotenv import load_dotenv
    load_dotenv()

VERIFY_SSL = not IS_LOCAL
AWS_REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")


def boto_client(service):
    return boto3.client(service, region_name=AWS_REGION, verify=VERIFY_SSL)
