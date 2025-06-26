import * as cdk from 'aws-cdk-lib';
import { Duration, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  ISecurityGroup,
  IVpc,
  SecurityGroup,
  SubnetType,
  Vpc,
  VpcLookupOptions,
} from 'aws-cdk-lib/aws-ec2';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import * as path from 'node:path';
import {
  AssetImage,
  Cluster,
  ContainerInsights,
  CpuArchitecture,
  FargateTaskDefinition,
  LogDriver,
  Scope,
} from 'aws-cdk-lib/aws-ecs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import {
  ChainDefinitionBody,
  IntegrationPattern,
  JsonPath,
  Pass,
  StateMachine,
  Succeed,
  Timeout,
} from 'aws-cdk-lib/aws-stepfunctions';
import { EcsFargateLaunchTarget, EcsRunTask } from 'aws-cdk-lib/aws-stepfunctions-tasks';

/**
 * Props for the PgDD stack.
 */
export interface PgDDConfig {
  /**
   * The bucket to dump data to.
   */
  bucket: string;
  /**
   * Secret to connect to database with.
   */
  secretArn: string;
  /**
   * The key prefix when writing data.
   */
  prefix?: string;
  /**
   * Props to lookup the VPC with.
   */
  vpcProps: VpcLookupOptions;
  /**
   * Existing security group name to be attached on lambda.
   */
  lambdaSecurityGroupName: string;
  /**
   * How long to retain logs from the fargate task.
   */
  logRetention?: RetentionDays;
}

/**
 * Props for the PgDD stack which can be configured
 */
export type PgDDProps = StackProps & PgDDConfig;

export class PgDDStack extends cdk.Stack {
  private readonly vpc: IVpc;
  private readonly securityGroup: ISecurityGroup;
  private readonly role: Role;
  private readonly cluster: Cluster;

  constructor(scope: Construct, id: string, props: PgDDProps) {
    super(scope, id, props);

    this.vpc = Vpc.fromLookup(this, 'MainVpc', props.vpcProps);
    this.securityGroup = SecurityGroup.fromLookupByName(
      this,
      'OrcaBusLambdaSecurityGroup',
      props.lambdaSecurityGroupName,
      this.vpc
    );

    this.role = new Role(this, 'Role', {
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'PgDD fargate execution role',
      maxSessionDuration: Duration.hours(12),
    });
    this.role.addToPolicy(
      new PolicyStatement({
        resources: ['*'],
        actions: ['states:SendTaskSuccess', 'states:SendTaskFailure', 'states:SendTaskHeartbeat'],
      })
    );
    this.role.addToPolicy(
      new PolicyStatement({
        actions: ['s3:PutObject'],
        resources: [`arn:aws:s3:::${props.bucket}`, `arn:aws:s3:::${props.bucket}/*`],
      })
    );
    this.role.addToPolicy(
      new PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [`${props.secretArn}-*`],
      })
    );

    this.cluster = new Cluster(this, 'FargateCluster', {
      vpc: this.vpc,
      enableFargateCapacityProviders: true,
      containerInsightsV2: ContainerInsights.ENHANCED,
    });

    const entry = path.join(__dirname, '..', '..', 'app');
    const name = 'orcabus-pg-dd';
    const taskDefinition = new FargateTaskDefinition(this, 'TaskDefinition', {
      runtimePlatform: {
        cpuArchitecture: CpuArchitecture.ARM64,
      },
      cpu: 256,
      ephemeralStorageGiB: 100,
      memoryLimitMiB: 1024,
      taskRole: this.role,
      family: name,
      volumes: [
        {
          name: 'tmp',
          dockerVolumeConfiguration: {
            driver: 'local',
            scope: Scope.TASK,
          },
        },
      ],
    });
    const container = taskDefinition.addContainer('Container', {
      stopTimeout: Duration.seconds(120),
      image: new AssetImage(entry, {
        platform: Platform.LINUX_ARM64,
      }),
      readonlyRootFilesystem: true,
      logging: LogDriver.awsLogs({
        streamPrefix: 'pg-dd',
        logRetention: props.logRetention,
      }),
      environment: {
        PG_DD_SECRET: props.secretArn,
        PG_DD_BUCKET: props.bucket,
        PG_DD_DIR: 'tmp',
        PG_DD_DATABASE_METADATA_MANAGER: 'metadata_manager',
        PG_DD_DATABASE_SEQUENCE_RUN_MANAGER: 'sequence_run_manager',
        PG_DD_DATABASE_WORKFLOW_MANAGER: 'workflow_manager',
        PG_DD_DATABASE_FILEMANAGER: 'filemanager',
        PG_DD_DATABASE_FILEMANAGER_SQL_DUMP:
          'select * from s3_object order by event_time desc limit 10000',
        PG_DD_DATABASE_FILEMANAGER_SQL_LOAD: 's3_object',
        ...(props.prefix && { PG_DD_PREFIX: props.prefix }),
      },
    });
    container.addMountPoints({
      sourceVolume: 'tmp',
      containerPath: '/tmp',
      readOnly: false,
    });

    const securityGroupEgress = new SecurityGroup(this, 'SecurityGroup', {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: 'Security group that allows the PgDD task to egress out.',
    });
    const startState = new Pass(this, 'StartState');
    const task = new EcsRunTask(this, 'RunPgDD', {
      cluster: this.cluster,
      taskTimeout: Timeout.duration(Duration.hours(12)),
      integrationPattern: IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      taskDefinition: taskDefinition,
      launchTarget: new EcsFargateLaunchTarget(),
      securityGroups: [securityGroupEgress, this.securityGroup],
      subnets: {
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      },
      containerOverrides: [
        {
          containerDefinition: container,
          command: JsonPath.listAt('$.commands'),
          environment: [
            {
              name: 'PG_DD_TASK_TOKEN',
              value: JsonPath.stringAt('$$.Task.Token'),
            },
          ],
        },
      ],
    });
    const finish = new Succeed(this, 'SuccessState');

    new StateMachine(this, 'StateMachine', {
      stateMachineName: name,
      definitionBody: ChainDefinitionBody.fromChainable(startState.next(task).next(finish)),
    });
  }
}
