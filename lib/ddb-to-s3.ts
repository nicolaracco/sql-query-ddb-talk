import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import { LambdaDDBEventSource } from './lambda-ddb-event-source';

export interface DDBToS3Props {
  table: dynamodb.ITable;
  conversionLambdaEntry: string;
  entities: string[];
}

export class DDBToS3 extends Construct {
  constructor(scope: Construct, id: string, props: DDBToS3Props) {
    super(scope, id);

    const rawObjectsPrefix = 'raw/';
    const bucket = new s3.Bucket(this, 'Resource', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    const dataDumper = new lambdaNode.NodejsFunction(this, 'DataDumper', {
      entry: props.conversionLambdaEntry,
      environment: {
        BUCKET_NAME: bucket.bucketName,
        OBJECT_PREFIX: rawObjectsPrefix,
      },
    });
    bucket.grantWrite(dataDumper, `${rawObjectsPrefix}*`);

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
