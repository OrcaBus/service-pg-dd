import { App } from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import { StatelessStack } from '../infrastructure/toolchain/stateless-stack';
import { cdkNagStack } from './stage.test';
import { StatefulStack } from '../infrastructure/toolchain/stateful-stack';

describe('cdk-nag-stateless-toolchain-stack', () => {
  const app = new App({});

  const statelessStack = new StatelessStack(app, 'StatelessStack', {
    env: {
      account: '123456789',
      region: 'ap-southeast-2',
    },
  });

  cdkNagStack(statelessStack, (stack) => {
    NagSuppressions.addStackSuppressions(stack, [
      { id: 'AwsSolutions-IAM5', reason: 'Allow CDK Pipeline' },
      { id: 'AwsSolutions-S1', reason: 'Allow CDK Pipeline' },
      { id: 'AwsSolutions-KMS5', reason: 'Allow CDK Pipeline' },
    ]);
  });
});

describe('cdk-nag-stateful-toolchain-stack', () => {
  const app = new App({});

  const statefulStack = new StatefulStack(app, 'StatelessStack', {
    env: {
      account: '123456789',
      region: 'ap-southeast-2',
    },
  });

  cdkNagStack(statefulStack, (stack) => {
    NagSuppressions.addStackSuppressions(stack, [
      { id: 'AwsSolutions-IAM5', reason: 'Allow CDK Pipeline' },
      { id: 'AwsSolutions-S1', reason: 'Allow CDK Pipeline' },
      { id: 'AwsSolutions-KMS5', reason: 'Allow CDK Pipeline' },
    ]);
  });
});
