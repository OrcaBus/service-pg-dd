import gzip
import logging
import os
import subprocess
from enum import StrEnum
from time import strftime
from typing import Dict, List, Any, Tuple, LiteralString

import boto3
import psycopg
from psycopg import sql
from mypy_boto3_s3 import S3ServiceResource

from dotenv import load_dotenv

load_dotenv()


class PgDDMode(StrEnum):
    """
    Determines the operating mode, either by using the pg_dump/pg_restore command or by using a custom
    copy command with CSV format.
    """

    PG_DUMP = "pg-dump"
    COPY_CSV = "copy-csv"

    @staticmethod
    def from_env() -> "PgDDMode":
        """
        Load the mode from the environment.
        """
        mode = os.getenv("PG_DD_MODE")
        PgDDMode.from_str(mode)

    @staticmethod
    def from_str(mode: str | None) -> "PgDDMode":
        """
        Load the mode from a string
        """
        if mode is None or mode == PgDDMode.PG_DUMP:
            return PgDDMode.PG_DUMP
        elif mode == PgDDMode.COPY_CSV:
            return PgDDMode.COPY_CSV
        else:
            raise RuntimeError(f"unknown mode: {mode}")


class PgDD:
    """
    A class to manage dumping/loading CSV files to a Postgres database.
    """

    def __init__(self, logger: logging.Logger = logging.getLogger(__name__)):
        self.url = os.getenv("PG_DD_URL")
        self.databases = self.read_databases()
        self.logger = logger

    def csvs_for_tables(self, db: str = None) -> Dict[str, Dict[str, str]]:
        """
        Get csvs for all tables in all databases.
        """

        databases = {}
        for entry in self.databases.values():
            database = entry["database"]
            if db is not None and db != database:
                continue

            url = f"{self.url}/{database}"

            conn: psycopg.connection.Connection
            with psycopg.connect(url) as conn:
                if entry.get("sql_dump") is not None:
                    tables = [(i, e, True) for i, e in enumerate(entry["sql_dump"])]
                else:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            select table_name from information_schema.tables
                            where table_schema = 'public';
                            """
                        )
                        tables = [(name[0], name[0], False) for name in cur.fetchall()]
                        self.logger.info(f"fetched table names: {tables}")

                with conn.cursor() as cur:
                    databases[entry["database"]] = self.copy_tables_to_csv(cur, tables)

        return databases

    def list_databases(self) -> List[str]:
        """
        List all databases.
        """
        databases = []

        conn: psycopg.connection.Connection
        with psycopg.connect(self.url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    select datname from pg_database
                    where datistemplate = false;
                    """
                )
                databases = [name[0] for name in cur.fetchall()]
                self.logger.info(f"fetched databases: {databases}")

        return databases

    def load_table(
        self,
        table: str,
        data: str,
        conn: psycopg.connection.Connection,
        only_empty: bool = True,
    ):
        """
        Load a table with the CSV data.
        """

        with conn.cursor() as cur:
            if only_empty:
                exists = cur.execute(
                    sql.SQL(
                        """
                        select exists(
                            select from pg_tables where tablename = '{}'
                        );
                        """
                    ).format(sql.SQL(table))
                ).fetchone()[0]
                has_records = cur.execute(
                    sql.SQL(
                        """
                        select exists(select * from {})
                        """
                    ).format(sql.SQL(table))
                ).fetchone()[0]

                if not exists or has_records:
                    return

            with cur.copy(
                sql.SQL(
                    """
                    copy {} from stdin with (format csv, header);
                    """
                ).format(sql.Identifier(table)),
            ) as copy:
                copy.write(data)

    def target_files(self, db: str = None) -> List[Tuple[str, str, str, str]]:
        """
        Get the target files for all directories.
        """

        files = []
        for database, tables in self.csvs_for_tables(db).items():
            for table, value in tables.items():
                file = f"{database}/{table}.csv.gz"
                files += [(database, table, file, value)]
        return files

    @staticmethod
    def read_databases() -> Dict[str, Dict[str, Any]]:
        """
        Read the databases to dump from env variables.
        """

        prefix = "PG_DD_DATABASE_"
        sql_dump_prefix = "_SQL_DUMP"
        sql_load_prefix = "_SQL_LOAD"
        variables = {}
        for key, value in os.environ.items():
            if key[: len(prefix)] == prefix:
                database = key[len(prefix) :]
                suffix_dump = database[-len(sql_dump_prefix) :]
                suffix_load = database[-len(sql_load_prefix) :]

                database = database.removesuffix(sql_dump_prefix).removesuffix(
                    sql_load_prefix
                )
                variables.setdefault(database, {})

                if suffix_dump == sql_dump_prefix:
                    variables[database]["sql_dump"] = [
                        s.strip() for s in value.split(",")
                    ]
                elif suffix_load == sql_load_prefix:
                    variables[database]["sql_load"] = [
                        s.strip() for s in value.split(",")
                    ]
                else:
                    variables[database]["database"] = database.lower()

        return variables

    @staticmethod
    def copy_tables_to_csv(
        cur: psycopg.cursor.Cursor, tables: List[Tuple[str, str, bool]]
    ) -> Dict[str, str]:
        """
        Get tables as a csv string.
        """

        csvs = {}
        for name, table, is_statement in tables:
            if is_statement:
                statement = sql.SQL(
                    """
                    copy ({}) to stdout with (format csv, header);
                    """
                )
            else:
                statement = sql.SQL(
                    """
                    copy {} to stdout with (format csv, header);
                    """
                )

            rows = []
            copy: psycopg.Copy
            table: LiteralString = table
            with cur.copy(statement.format(sql.SQL(table))) as copy:
                for row in copy:
                    rows += [row.tobytes().decode("utf-8")]

            csvs[name] = "".join(rows)

        return csvs


class PgDDLocal(PgDD):
    """
    Commands related to dumping/loading CSV files to a local directory.
    """

    def __init__(
        self,
        out_dir=os.getenv("PG_DD_DIR"),
        logger: logging.Logger = logging.getLogger(__name__),
        mode: PgDDMode = PgDDMode.from_env(),
    ):
        super().__init__(logger=logger)
        self.out = out_dir
        os.makedirs(self.out, exist_ok=True)

        self.bucket = os.getenv("PG_DD_BUCKET")
        self.prefix = os.getenv("PG_DD_PREFIX")
        self.mode = PgDDMode.from_str(mode)
        self.s3: S3ServiceResource = boto3.resource("s3")

    def write_pg_dump(self, db: str = None):
        """
        Write using pg-dump mode.
        """
        for database in self.list_databases() if db is None else [db]:
            # Skip admin databases
            if database == "postgres" or database == "rdsadmin":
                continue

            out = subprocess.run(
                [
                    "pg_dump",
                    "-Fc",
                    "-d",
                    f"{self.url}/{database}",
                    "-f",
                    f"{self.out}/{database}.dump",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            self.logger.info(out.stdout)

    def write_csv(self, db: str = None):
        """
        Write using copy-csv mode.
        """
        for _, _, f, value in self.target_files(db):
            file = f"{self.out}/{f}"
            self.logger.info(f"writing to file: {f}")

            with open(file, "wb") as file:
                file.write(gzip.compress(str.encode(value)))

    def write_to_dir(self, db: str = None):
        """
        Write the CSV files to the output directory.
        """
        if self.mode == PgDDMode.PG_DUMP:
            self.write_pg_dump(db)
        else:
            self.write_csv(db)

    def load_csv(self, only_empty: bool = True):
        """
        Load using copy-csv mode.
        """

        def load_files():
            for root, _, files in os.walk(f"{self.out}/{database}"):
                for file in files:
                    with open(f"{root}/{file}", "rb") as f:
                        table = file.removesuffix(".csv.gz")
                        load = self.databases[database.upper()].get("sql_load")
                        if load is not None:
                            table = load[int(table)]

                        self.load_table(
                            table,
                            gzip.decompress(f.read()).decode("utf-8"),
                            conn,
                            only_empty,
                        )

        for _, dirs, _ in os.walk(self.out):
            for database in dirs:
                conn: psycopg.connection.Connection
                url = f"{self.url}/{database}"
                with psycopg.connect(url) as conn:
                    self.logger.info(f"connecting to: {url}")

                    conn.set_deferrable(True)
                    load_files()
                    conn.commit()

    def load_pg_restore(self):
        """
        Load using pg-dump mode.
        """
        for root, _, databases in os.walk(self.out):
            for database in databases:
                out = subprocess.run(
                    ["pg_restore", "-C", "-d", f"{self.url}", f"{root}/{database}"],
                    capture_output=True,
                    check=True,
                    text=True,
                )
                self.logger.info(out.stdout)

    def load_to_database(self, only_empty: bool = True):
        """
        Load CSV files to the database.
        """
        if self.mode == PgDDMode.PG_DUMP:
            self.load_pg_restore()
        else:
            self.load_csv(only_empty)


class PgDDS3(PgDD):
    """
    Commands related to dumping/loading from S3.
    """

    def __init__(
        self,
        out_dir=os.getenv("PG_DD_DIR"),
        logger: logging.Logger = logging.getLogger(__name__),
    ):
        super().__init__(logger=logger)
        self.bucket = os.getenv("PG_DD_BUCKET")
        self.prefix = os.getenv("PG_DD_PREFIX")
        self.dir = out_dir
        self.s3: S3ServiceResource = boto3.resource("s3")

    def write_to_bucket(self, db: str = None):
        """
        Write the CSV files to the S3 bucket.
        """

        for root, _, files in os.walk(self.dir):
            for file in files:
                file = os.path.join(root, file)
                key = file.removeprefix(self.dir).removeprefix("/")

                if key == "" or (db is not None and not key.startswith(db)):
                    continue

                if self.prefix:
                    key = f"{self.prefix}/{strftime('%Y%m%d')}/{key}"

                self.logger.info(f"writing to bucket with key: {key}")

                s3_object = self.s3.Object(self.bucket, key)
                with open(file, "rb") as f:
                    s3_object.put(Body=f.read())

    def download_local(self, exists_ok: bool = True):
        """
        Download from S3 CSV files to load.
        """

        objects = self.s3.Bucket(self.bucket).objects.filter(Prefix=self.prefix)
        for obj in objects:
            split = obj.key.rsplit("/", 2)
            directory = f"{self.dir}/{split[-2]}"
            os.makedirs(directory, exist_ok=True)
            file = f"{directory}/{split[-1]}"

            if exists_ok and os.path.exists(file):
                self.logger.info(f"file already exists: {file}")
                continue

            s3_object = self.s3.Object(self.bucket, obj.key).get()
            data = s3_object["Body"].read()
            with open(file, "wb") as f:
                f.write(data)
