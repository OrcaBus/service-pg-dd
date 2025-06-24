import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration, RemovalPolicy, StackProps } from 'aws-cdk-lib';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';

/**
 * Props for the PgDD stateful stack.
 */
export interface PgDDStatefulConfig {
  /**
   * The bucket to dump data to.
   */
  bucket: string;
}

/**
 * Props for the PgDD stack which can be configured.
 */
export type PgDDStatefulProps = StackProps & PgDDStatefulConfig;

export class PgDDStatefulStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PgDDStatefulProps) {
    super(scope, id, props);

    new Bucket(this, 'Bucket', {
      bucketName: props.bucket,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          expiredObjectDeleteMarker: true,
          noncurrentVersionExpiration: Duration.days(7),
          abortIncompleteMultipartUploadAfter: Duration.days(7),
        },
      ],
    });
  }
}
