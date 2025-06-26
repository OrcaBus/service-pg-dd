from pg_dd.pg_dd import PgDDLocal, PgDDS3
import click
import json
import logging
import os
import sys
from types import SimpleNamespace

import boto3
from libumccr.aws import libsm
from mypy_boto3_stepfunctions import SFNClient

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


def main():
    try:
        cli(standalone_mode=False)
        send_output()
        sys.exit(0)
    except Exception as e:
        send_failure(str(e))
        logger.error(str(e))
        sys.exit(1)


@click.group()
def cli():
    pass


@cli.command()
@click.option(
    "--exists-ok/--no-exists-ok",
    default=True,
    help="If the file already exists, do not download it.",
)
def download(exists_ok):
    """
    Download S3 CSV dumps to the local directory.
    """
    PgDDS3(logger=logger).download_local(exists_ok)


@cli.command()
@click.option(
    "--database",
    help="Specify the database to upload, uploads all databases by default.",
)
@click.option(
    "--dump-db/--no-dump-db",
    default=False,
    help="Dump from the database first before uploading.",
)
@click.option(
    "--mode",
    help="Specify the mode if dumping the database, either copy-csv or pg-dump.",
)
def upload(database, dump_db, mode):
    """
    Uploads local CSV dumps to S3.
    """
    if dump_db:
        PgDDLocal(logger=logger, mode=mode).write_to_dir(database)

    PgDDS3(logger=logger).write_to_bucket(database)


@cli.command()
@click.option(
    "--database", help="Specify the database to dump, dumps all databases by default."
)
@click.option("--mode", help="Specify the mode, either copy-csv or pg-dump.")
def dump(database, mode):
    """
    Dump from the local database to CSV files.
    """
    PgDDLocal(logger=logger, mode=mode).write_to_dir(database)


@cli.command()
@click.option(
    "--download-exists-ok/--no-download-exists-ok",
    default=True,
    help="Download the CSV files from S3 if they are not already in the local directory.",
)
@click.option(
    "--only-empty/--no-only-empty",
    default=True,
    help="Only load into tables that are empty and exist in the database.",
)
@click.option("--mode", help="Specify the mode, either copy-csv or pg-dump.")
def load(download_exists_ok, only_empty, mode):
    """
    Load local CSV files into the database.
    """
    if download_exists_ok:
        PgDDS3(logger=logger).download_local(download_exists_ok)

    PgDDLocal(logger=logger, mode=mode).load_to_database(only_empty)


if __name__ == "__main__":
    main()
