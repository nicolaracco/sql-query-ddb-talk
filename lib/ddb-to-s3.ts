import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import { LambdaDDBEventSource } from './lambda-ddb-event-source';
import { RemovalPolicy } from 'aws-cdk-lib';

export interface DDBToS3Props {
  table: dynamodb.ITable;
  conversionLambdaEntry: string;
  entities: string[];
  removalPolicy: RemovalPolicy;
}

export class DDBToS3 extends Construct {
  readonly bucket: s3.Bucket;
  readonly rawObjectsPrefix: string = 'raw/';

  constructor(scope: Construct, id: string, props: DDBToS3Props) {
    super(scope, id);

    this.bucket = new s3.Bucket(this, 'Resource', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: props.removalPolicy,
      autoDeleteObjects: props.removalPolicy === RemovalPolicy.DESTROY,
    });

    const dataDumper = new lambdaNode.NodejsFunction(this, 'DataDumper', {
      entry: props.conversionLambdaEntry,
      environment: {
        BUCKET_NAME: this.bucket.bucketName,
        OBJECT_PREFIX: this.rawObjectsPrefix,
      },
    });
    this.bucket.grantWrite(dataDumper, `${this.rawObjectsPrefix}*`);

    new LambdaDDBEventSource(this, 'EventSource', {
      target: dataDumper,
      table: props.table,
      startingPosition: lambda.StartingPosition.LATEST,
      filterPatterns: [
        {
          dynamodb: {
            NewImage: {
              _et: { S: props.entities },
            },
          },
        },
        {
          dynamodb: {
            OldImage: {
              _et: { S: props.entities },
            },
          },
        },
      ],
      bisectBatchOnError: true,
    });
  }
}
