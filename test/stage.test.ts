import { App, Aspects } from 'aws-cdk-lib';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { PgDDStack } from '../infrastructure/stage/pg-dd-stack';
import { getPgDDConfig } from '../infrastructure/stage/config';
import { synthesisMessageToString } from '@orcabus/platform-cdk-constructs/utils';

describe('cdk-nag-stateless-toolchain-stack', () => {
  const app = new App();

  const stack = new PgDDStack(app, 'PgDDStack', {
    ...getPgDDConfig('PROD'),
    env: {
      account: '123456789',
      region: 'ap-southeast-2',
    },
  });

  Aspects.of(stack).add(new AwsSolutionsChecks());

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

  NagSuppressions.addStackSuppressions(
    stack,
    [{ id: 'AwsSolutions-IAM4', reason: 'allow to use AWS managed policy' }],
    true
  );
  NagSuppressions.addResourceSuppressions(
    stack,
    [
      {
        id: 'AwsSolutions-IAM5',
        reason: "'*' is required to access objects and secrets",
        appliesTo: [
          'Resource::arn:aws:s3:::orcabus-test-data-472057503814-ap-southeast-2/*',
          'Resource::arn:aws:secretsmanager:ap-southeast-2:472057503814:secret:orcabus/master-rds-*',
        ],
      },
    ],
    true
  );
});
