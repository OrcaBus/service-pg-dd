import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DeploymentStackPipeline } from '@orcabus/platform-cdk-constructs/deployment-stack-pipeline';
import { Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { getPgDDConfig } from '../stage/config';
import { PgDDStatefulStack } from '../stage/pg-dd-stateful-stack';

export class StatefulStack extends cdk.Stack {
  readonly pipeline: Pipeline;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const deployment = new DeploymentStackPipeline(this, 'DeploymentPipeline', {
      githubBranch: 'feat/backup-bucket',
      githubRepo: 'service-pg-dd',
      stack: PgDDStatefulStack,
      stackName: 'PgDDStatefulStack',
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
      pipelineName: 'OrcaBus-StatefulPgDD',
      cdkSynthCmd: ['pnpm install --frozen-lockfile --ignore-scripts', 'pnpm cdk-stateless synth'],
    });

    this.pipeline = deployment.pipeline;
  }
}
