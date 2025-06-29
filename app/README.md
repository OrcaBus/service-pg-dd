# Postgres data dump

Postgres data dump - a service that dumps (like `dd`) the orcabus postgres databases to S3.

## Usage

Call the deployed function to update the current dump:

```sh
export ARN=$(aws stepfunctions list-state-machines | jq -r '.stateMachines | .[] | select(.name == "orcabus-pg-dd") | .stateMachineArn')
aws stepfunctions start-execution --state-machine-arn $ARN  --input \
  "{\
    \"commands\": [\
      \"upload\",\
      \"--dump-db\"\
    ]\
  }"
```

This is setup to dump the all databases except `postgres` and `rdsadmin`.

This command can be run locally using make, or by running `poetry` directly:

```sh
make cli COMMAND="--help"
```

For example, to dump and upload a specific database to s3:

```sh
poetry run cli dump --database metadata_manager && poetry run cli upload
```

The `Dockerfile` is setup to launch with the top-level `Makefile`, which also contains commands for running the CLI.

By default, this tool uses `pg_dump`/`pg_restore` for database backup. It's also possible to use a custom `copy` command
to dump data to CSV files. This allows controlling the exact query used for the dump (e.g. by dumping only the first 10000 rows).
Pass `--mode copy-csv` to use this feature instead of `pg_dump`.

## Configuration

This function can be configured by setting the following environment variables, see [.env.example][env-example] for an example:

| Name                                      | Description                                                                                                                            | Type                              |
|-------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------|
| `PG_DD_URL`                               | The database URL to dump databases from.                                                                                               | Postgres connection string        |
| `PG_DD_SECRET`                            | The secret name or ARN to fetch the database URL from. This is only used in the deployed function, and overrides `PG_DD_URL`.          | `string`                          |
| `PG_DD_BUCKET`                            | The bucket to dump data to.                                                                                                            | `string` or undefined             |
| `PG_DD_PREFIX`                            | The bucket prefix to use when writing to a bucket. This is optional.                                                                   | `string` or undefined             |
| `PG_DD_DIR`                               | The local filesystem directory to dump data to when running this command locally.                                                      | filesystem directory or undefined |
| `PG_DD_MODE`                              | The mode of operating, either copy-csv which uses a custom `copy` command to dump data, or `pg-dump` which uses the `pg_dump` command. | filesystem directory or undefined |

The following options are used to configure the databases to dump is using `copy-csv` mode:

| Name                                      | Description                                                                                                                                                                                                                             | Type                    |
|-------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------|
| `PG_DD_DATABASE_<DATABASE_NAME>`          | A name of the database to dump records from where `<DATABASE_NAME>` represents the target database. Specify this multiple times to use dump from multiple databases. This option is ignored if using `pg-dump` mode.                    |  `string`               |
| `PG_DD_DATABASE_<DATABASE_NAME>_SQL_DUMP` | Custom SQL code to execute when dumping database records for `<DATABASE_NAME>`. This is optional, and by default all records from all tables are dumped. Specify this is a list of SQL statements to generate a corresponding CSV file. | `string[]` or undefined |
| `PG_DD_DATABASE_<DATABASE_NAME>_SQL_LOAD` | The name of the table to load into for `<DATABASE_NAME>`. This is required if loading data after dumping with `<PG_DD_DATABASE_DATABASE_NAME_SQL_DUMP>` to specify the table to load data into.                                         | `string[]` or undefined |

## Local development

This project uses [poetry] to manage dependencies.

Run the linter and formatter:

```
make check
```

[poetry]: https://python-poetry.org/
[env-example]: .env.example
