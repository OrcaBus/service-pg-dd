import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DeploymentStackPipeline } from '@orcabus/platform-cdk-constructs/deployment-stack-pipeline';
import { Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { PgDDStack } from '../stage/pg-dd-stateless-stack';
import { getPgDDConfig } from '../stage/config';

export class StatelessStack extends cdk.Stack {
  readonly pipeline: Pipeline;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const buildSpec = {
      phases: {
        install: {
          'runtime-versions': {
            nodejs: '24.x',
            python: '3.13',
          },
        },
      },
    };

    const deployment = new DeploymentStackPipeline(this, 'DeploymentPipeline', {
      githubBranch: 'main',
      githubRepo: 'service-pg-dd',
      stack: PgDDStack,
      stackName: 'PgDDStack',
      stackConfig: {
        beta: {
          ...getPgDDConfig('BETA'),
        },
        gamma: {
          ...getPgDDConfig('GAMMA'),
        },
        prod: {
          ...getPgDDConfig('PROD'),
        },
      },
      pipelineName: 'OrcaBus-StatelessPgDD',
      cdkSynthCmd: ['pnpm cdk-stateless synth'],
      synthBuildSpec: buildSpec,
      unitAppTestConfig: {
        command: ['cd app', 'make test'],
        partialBuildSpec: buildSpec,
      },
      unitIacTestConfig: {
        command: ['pnpm test --testPathPatterns=test/stateless'],
        partialBuildSpec: buildSpec,
      },
    });

    this.pipeline = deployment.pipeline;
  }
}
