import { App, Stack } from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import { PgDDStatefulStack } from '../../infrastructure/stage/pg-dd-stateful-stack';
import { getPgDDStatefulConfig } from '../../infrastructure/stage/config';
import { cdkNagStack } from '../util';

/**
 * Apply nag suppression for the stateful stage stack.
 */
function applyStatefulNagSuppressions(stack: Stack) {
  NagSuppressions.addResourceSuppressionsByPath(
    stack,
    '/PgDDStatefulStack/Bucket/Resource',
    [
      {
        id: 'AwsSolutions-S1',
        reason: 'S3 bucket is accessed by function or for administrative purposes only.',
      },
    ],
    true
  );
}

describe('cdk-nag-stateful-stack', () => {
  const app = new App();

  const stack = new PgDDStatefulStack(app, 'PgDDStatefulStack', {
    ...getPgDDStatefulConfig('PROD'),
    env: {
      account: '123456789',
      region: 'ap-southeast-2',
    },
  });

  cdkNagStack(stack, applyStatefulNagSuppressions);
});
