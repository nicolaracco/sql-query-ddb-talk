import { Construct } from 'constructs';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { IStateMachine } from 'aws-cdk-lib/aws-stepfunctions';

export interface S3ToSfnConnectorProps {
  bucket: s3.IBucket;
  stateMachine: IStateMachine;
  removalPolicy: RemovalPolicy;
  prefix: string;
}

export class S3ToSfnConnector extends Construct {
  constructor(scope: Construct, id: string, props: S3ToSfnConnectorProps) {
    super(scope, id);

    const s3ChangesQueue = new sqs.Queue(this, 'S3ChangesQueue', {
      fifo: true,
      contentBasedDeduplication: true,
      removalPolicy: props.removalPolicy,
      deliveryDelay: Duration.minutes(5),
    });

    const sqsEnqueuer = new lambdaNode.NodejsFunction(this, 'SqsEnqueuer', {
      entry: 'lambda/s3-to-sfn/s3-notification.handler.ts',
      environment: {
        QUEUE_URL: s3ChangesQueue.queueUrl,
      },
    });

    s3ChangesQueue.grantSendMessages(sqsEnqueuer);

    props.bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(sqsEnqueuer), {
      prefix: props.prefix,
    });
    props.bucket.addEventNotification(s3.EventType.OBJECT_REMOVED, new s3n.LambdaDestination(sqsEnqueuer), {
      prefix: props.prefix,
    });

    const stepFunctionStarter = new lambdaNode.NodejsFunction(this, 'StepFunctionStarter', {
      entry: 'lambda/s3-to-sfn/sqs.handler.ts',
      environment: {
        STATE_MACHINE_ARN: props.stateMachine.stateMachineArn,
      },
    });

    props.stateMachine.grantStartExecution(stepFunctionStarter);

    stepFunctionStarter.addEventSource(new SqsEventSource(s3ChangesQueue));
  }
}
