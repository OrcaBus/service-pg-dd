import {
  ACCOUNT_ID_ALIAS,
  REGION,
  StageName,
} from '@orcabus/platform-cdk-constructs/shared-config/accounts';
import { PgDDConfig } from './pg-dd-stateless-stack';
import {
  SHARED_SECURITY_GROUP_NAME,
  VPC_LOOKUP_PROPS,
} from '@orcabus/platform-cdk-constructs/shared-config/networking';
import { RDS_MASTER_SECRET_NAME } from '@orcabus/platform-cdk-constructs/shared-config/database';
import { PgDDStatefulConfig } from './pg-dd-stateful-stack';
import { DEFAULT_LOGS_CONFIG } from '@orcabus/platform-cdk-constructs/api-gateway';

export const getPgDDConfig = (stage: StageName): PgDDConfig => {
  return {
    bucket: `orcabus-test-data-${ACCOUNT_ID_ALIAS[stage]}-${REGION}`,
    prefix: 'pg-dd',
    secretArn: `arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID_ALIAS[stage]}:secret:${RDS_MASTER_SECRET_NAME}`, // pragma: allowlist secret
    lambdaSecurityGroupName: SHARED_SECURITY_GROUP_NAME,
    vpcProps: VPC_LOOKUP_PROPS,
    logRetention: DEFAULT_LOGS_CONFIG[stage].retention,
  };
};

export const getPgDDStatefulConfig = (stage: StageName): PgDDStatefulConfig => {
  return {
    bucket: `orcabus-pg-dd-${ACCOUNT_ID_ALIAS[stage]}-${REGION}`,
  };
};
