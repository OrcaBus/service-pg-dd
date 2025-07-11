import { App, Aspects, Stack } from 'aws-cdk-lib';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { PgDDStack } from '../infrastructure/stage/pg-dd-stateless-stack';
import { getPgDDConfig, getPgDDStatefulConfig } from '../infrastructure/stage/config';
import { synthesisMessageToString } from '@orcabus/platform-cdk-constructs/utils';
import { PgDDStatefulStack } from '../infrastructure/stage/pg-dd-stateful-stack';

/**
 * Run the CDK nag checks.
 */
export function cdkNagStack(stack: Stack, applySuppressions: (stack: Stack) => void) {
  Aspects.of(stack).add(new AwsSolutionsChecks());
  applySuppressions(stack);

  test(`cdk-nag AwsSolutions Pack errors`, () => {
    const errors = Annotations.fromStack(stack)
      .findError('*', Match.stringLikeRegexp('AwsSolutions-.*'))
      .map(synthesisMessageToString);
    expect(errors).toHaveLength(0);
  });

  test(`cdk-nag AwsSolutions Pack warnings`, () => {
    const warnings = Annotations.fromStack(stack)
      .findWarning('*', Match.stringLikeRegexp('AwsSolutions-.*'))
      .map(synthesisMessageToString);
    expect(warnings).toHaveLength(0);
  });
}

describe('cdk-nag-stateless-stack', () => {
  const app = new App();

  const stack = new PgDDStack(app, 'PgDDStack', {
    ...getPgDDConfig('PROD'),
    env: {
      account: '123456789',
      region: 'ap-southeast-2',
    },
  });

  cdkNagStack(stack, (stack) => {
    NagSuppressions.addStackSuppressions(
      stack,
      [{ id: 'AwsSolutions-IAM4', reason: 'allow to use AWS managed policy' }],
      true
    );
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      '/PgDDStack/StateMachine/Resource',
      [
        {
          id: 'AwsSolutions-SF1',
          reason: 'Container has logging enabled and SFN is simple.',
        },
      ],
      true
    );
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      '/PgDDStack/StateMachine/Resource',
      [
        {
          id: 'AwsSolutions-SF2',
          reason: 'X-Ray tracing would be unused as the SFN is simple.',
        },
      ],
      true
    );
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      '/PgDDStack/FargateCluster/Resource',
      [
        {
          id: 'AwsSolutions-ECS4',
          reason: 'Container insights would be unused and can be updated if required.',
        },
      ],
      true
    );

    // Todo fix this by handling environment variables better.
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      '/PgDDStack/TaskDefinition/Resource',
      [
        {
          id: 'AwsSolutions-ECS2',
          reason: 'This will be fixed in up-coming issue.',
        },
      ],
      true
    );

    NagSuppressions.addStackSuppressions(
      stack,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: "'*' is required to access objects and secrets",
        },
      ],
      true
    );
  });
});

describe('cdk-nag-stateful-stack', () => {
  const app = new App();

  const stack = new PgDDStatefulStack(app, 'PgDDStack', {
    ...getPgDDStatefulConfig('PROD'),
    env: {
      account: '123456789',
      region: 'ap-southeast-2',
    },
  });

  cdkNagStack(stack, (stack) => {
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      '/PgDDStack/Bucket/Resource',
      [
        {
          id: 'AwsSolutions-S1',
          reason: 'S3 bucket is accessed by function or for administrative purposes only.',
        },
      ],
      true
    );
  });
});
