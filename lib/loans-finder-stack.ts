import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';
import { DDBAccessorFunction } from './ddb-accessor-function';
import { LambdaDDBEventSource } from './lambda-ddb-event-source';
import { RESTAPILayer } from './rest-api-layer';

export class LoansFinderStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const removalPolicy = RemovalPolicy.DESTROY;
    const logRetention = logs.RetentionDays.ONE_DAY;

    const table = new dynamodb.Table(this, 'Table', {
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy,
    });
    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
    });

    const variantRemover = new DDBAccessorFunction(this, 'LoanVariantRemover', {
      entry: 'lambda/loan_variants/on-loan-delete.ddb-stream.handler.ts',
      table,
      logRetention,
    });
    new LambdaDDBEventSource(this, 'OnLoanRemove', {
      target: variantRemover,
      table,
      filterPatterns: [
        {
          dynamodb: {
            OldImage: {
              _et: { S: ['loan'] },
            },
          },
          eventName: ['REMOVE'],
        },
      ],
      startingPosition: lambda.StartingPosition.LATEST,
      bisectBatchOnError: true,
    });

    new RESTAPILayer(this, 'Rest', {
      table,
      logRetention,
    });
  }
}