import os
import boto3

IS_LOCAL = os.path.exists(".env")
if IS_LOCAL:
    from dotenv import load_dotenv
    load_dotenv()

VERIFY_SSL = not IS_LOCAL
AWS_REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
# Optional dedicated sender address so emails don't appear to come from
# the recipient's own address (which triggers spam filters).
# Set CLOUDPULSE_SENDER_EMAIL in your .env or ECS task environment.
# Must be verified in AWS SES. Falls back to recipient if not set.
SENDER_EMAIL = os.environ.get("CLOUDPULSE_SENDER_EMAIL", "")


def boto_client(service):
    return boto3.client(service, region_name=AWS_REGION, verify=VERIFY_SSL)
