import json
import logging
import os
import sys
from types import SimpleNamespace

import boto3
from libumccr.aws import libsm
from mypy_boto3_stepfunctions import SFNClient

from pg_dd.cli import cli

logging.basicConfig()
logger = logging.getLogger()
logger.setLevel(logging.DEBUG)

try:
    secret_str = libsm.get_secret(os.getenv("PG_DD_SECRET"))
    secret = json.loads(secret_str, object_hook=lambda d: SimpleNamespace(**d))
    os.environ["PG_DD_URL"] = (
        f"{secret.engine}://{secret.username}:{secret.password}@{secret.host}:{secret.port}"
    )
except Exception as e:
    logger.error(f"retrieving database url from secrets manager: {e}")
    raise e


def send_output():
    """
    Send successful task response with the output.
    """
    task_token = os.getenv("PG_DD_TASK_TOKEN")
    if task_token is not None:
        client: SFNClient = boto3.client("stepfunctions")
        client.send_task_success(
            taskToken=task_token,
            output=json.dumps(
                {
                    "bucket": os.getenv("PG_DD_BUCKET"),
                    "prefix": os.getenv("PG_DD_PREFIX"),
                }
            ),
        )


def send_failure(error: str):
    """
    Send a failed task response.
    """
    task_token = os.getenv("PG_DD_TASK_TOKEN")
    if task_token is not None:
        client: SFNClient = boto3.client("stepfunctions")
        client.send_task_failure(taskToken=task_token, error=error)


def handler():
    try:
        cli(standalone_mode=False)
        send_output()
        sys.exit(0)
    except Exception as e:
        send_failure(str(e))
        logger.error(str(e))
        sys.exit(1)


if __name__ == "__main__":
    handler()
