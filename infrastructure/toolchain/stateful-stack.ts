import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DeploymentStackPipeline } from '@orcabus/platform-cdk-constructs/deployment-stack-pipeline';
import { Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { getPgDDStatefulConfig } from '../stage/config';
import { PgDDStatefulStack } from '../stage/pg-dd-stateful-stack';

export class StatefulStack extends cdk.Stack {
  readonly pipeline: Pipeline;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const buildSpec = {
      phases: {
        install: {
          'runtime-versions': {
            nodejs: '24.x',
          },
        },
      },
    };

    const deployment = new DeploymentStackPipeline(this, 'DeploymentPipeline', {
      githubBranch: 'main',
      githubRepo: 'service-pg-dd',
      stack: PgDDStatefulStack,
      stackName: 'PgDDStatefulStack',
      stackConfig: {
        beta: {
          ...getPgDDStatefulConfig('BETA'),
        },
        gamma: {
          ...getPgDDStatefulConfig('GAMMA'),
        },
        prod: {
          ...getPgDDStatefulConfig('PROD'),
        },
      },
      pipelineName: 'OrcaBus-StatefulPgDD',
      cdkSynthCmd: ['pnpm cdk-stateful synth'],
      synthBuildSpec: buildSpec,
      // No app tests for stateful stack.
      unitAppTestConfig: {
        command: [],
      },
      unitIacTestConfig: {
        command: ['pnpm test --testPathPatterns=test/stateful'],
        partialBuildSpec: buildSpec,
      },
    });

    this.pipeline = deployment.pipeline;
  }
}
