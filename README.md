Postgres data dump
================================================================================

Postgres data dump - a service that dumps (like `dd`) the orcabus postgres databases to S3.
This service dumps the databases to an S3 bucket. See the app [README][readme] for usage details.

### Permissions & Access Control

This service requires `s3:PutObject` access to the backup bucket and `secretsmanager:GetSecretValue` for the database
connection secret.

### Change Management

This service employs a fully automated CI/CD pipeline that automatically builds and releases all changes to the `main`
code branch.

There are no automated changelogs or releases, however semantic versioning is followed for any manual release, and
[conventional commits][conventional-commits] are used for future automation.

[conventional-commits]: https://www.conventionalcommits.org/en/v1.0.0/

Infrastructure & Deployment
--------------------------------------------------------------------------------

The postgres data dump consists of a Lambda function which performs the database backup and upload to S3.


### CDK Commands

You can access CDK commands using the `pnpm` wrapper script.

- **`cdk-stateless`**: Used to deploy the PgDD `PythonFunction`.

The type of stack to deploy is determined by the context set in the `./bin/deploy.ts` file. This ensures the correct stack is executed based on the provided context.

For example:

```sh
# Deploy a stateless stack
pnpm cdk-stateless <command>
```

### Stacks

This CDK project manages multiple stacks. The root stack (the only one that does not include `DeploymentPipeline` in its stack ID)
is deployed in the toolchain account and sets up a CodePipeline for cross-environment deployments to `beta`, `gamma`, and `prod`.

To list all available stacks, run the `cdk-stateless` script:

```sh
pnpm cdk-stateless ls
```

Output:

```sh
OrcaBusStatelessPgDDStack
OrcaBusStatelessPgDDStack/DeploymentPipeline/OrcaBusBeta/PgDDStack (OrcaBusBeta-PgDDStack)
OrcaBusStatelessPgDDStack/DeploymentPipeline/OrcaBusGamma/PgDDStack (OrcaBusGamma-PgDDStack)
OrcaBusStatelessPgDDStack/DeploymentPipeline/OrcaBusProd/PgDDStack (OrcaBusProd-PgDDStack)
```

Development
--------------------------------------------------------------------------------

### Project Structure

The root of the project is an AWS CDK project and the main application logic lives inside the `./app` folder.

The project is organized into the following directories:

- **`./app`**: Contains the main application logic written in Python.

- **`./bin/deploy.ts`**: Serves as the entry point of the application.

- **`./infrastructure`**: Contains the infrastructure code for the project:
    - **`./infrastructure/toolchain`**: Includes stacks for the stateless and stateful resources deployed in the toolchain account. These stacks primarily set up the CodePipeline for cross-environment deployments.
    - **`./infrastructure/stage`**: Defines the stage stacks for different environments:
        - **`./infrastructure/stage/config.ts`**: Contains environment-specific configuration files (e.g., `beta`, `gamma`, `prod`).
        - **`./infrastructure/stage/pg-dd-stack.ts`**: The CDK stack entry point for provisioning resources required by the application in `./app`.

- **`.github/workflows/pr-tests.yml`**: Configures GitHub Actions to run tests for `make check-all` (linting and code style), tests defined in `./test`, and `make test` for the `./app` directory.

- **`./test`**: Contains tests for CDK code compliance against `cdk-nag`.

### Setup

#### Requirements

This project requires Python for development. It's recommended for it to be installed to make use of local bundling,
however to just deploy the stack, all that should be required is pnpm and nodejs:

```sh
node --version
v22.9.0

# Update Corepack (if necessary, as per pnpm documentation)
npm install --global corepack@latest

# Enable Corepack to use pnpm
corepack enable pnpm

```

#### Install Dependencies

To install all required dependencies, run:

```sh
make install
```

### Conventions

A top-level [`Makefile`][makefile] contains commands to install, build, lint and test code. See the [`Makefile`][makefile-app] in the [`app`][app] directory
for commands to run lints against the application code. There are links to the app `Makefile` in the top-level `Makefile`.

### Linting & Formatting

Automated checks are enforced via pre-commit hooks, ensuring only checked code is committed. For details consult the `.pre-commit-config.yaml` file.

To run linting and formatting checks on the whole project (this requires [Poetry][poetry] and a Python environment to be set up), use:

```sh
make check-all
```

To automatically fix issues with ESLint and Prettier, run:

```sh
make fix
```

### Testing

The cdk-nag tests can be run with:

```sh
make test
```


[makefile]: Makefile
[makefile-app]: app/Makefile
[readme]: app/README.md
[app]: app
[bin]: bin
[infrastructure]: infrastructure
[test]: test
[pnpm]: https://pnpm.io/
[poetry]: https://python-poetry.org/
