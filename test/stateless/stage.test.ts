import { App, Stack } from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import { PgDDStack } from '../../infrastructure/stage/pg-dd-stateless-stack';
import { getPgDDConfig } from '../../infrastructure/stage/config';
import { cdkNagStack } from '../util';

/**
 * Apply nag suppression for the stateless stage stack.
 */
function applyStatelessNagSuppressions(stack: Stack) {
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

  cdkNagStack(stack, applyStatelessNagSuppressions);
});
