import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';
import { DDBAccessorFunction } from './ddb-accessor-function';
import { LambdaDDBEventSource } from './lambda-ddb-event-source';
import { DDBToS3 } from './ddb-to-s3';
import { RESTAPILayer } from './rest-api-layer';
import { GlueDB } from './glue-db';
import { OptimizeAthena } from './optimize-athena';

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

    const { bucket, rawObjectsPrefix } = new DDBToS3(this, 'DDBToS3', {
      table,
      conversionLambdaEntry: 'lambda/ddb-to-s3/ddb-stream.handler.ts',
      entities: ['loan', 'loan_variant', 'rate'],
      removalPolicy,
    });
    const glueDB = new GlueDB(this, 'DB', {
      bucket,
      rawObjectsPrefix,
    });

    const refinedObjectsPrefix = 'refined/';
    new OptimizeAthena(this, 'OptimizeAthena', {
      bucket,
      database: glueDB.database,
      refinedObjectsPrefix,
      removalPolicy,
      ddbTable: table,
      tables: {
        rates: {
          glueTable: glueDB.ratesTable,
          rawObjectsPrefix: `${rawObjectsPrefix}rate/`,
          refinedTableName: 'refined_rates',
        },
        loans: {
          glueTable: glueDB.loansTable,
          rawObjectsPrefix: `${rawObjectsPrefix}loan/`,
          refinedTableName: 'refined_loans',
        },
        loanVariants: {
          glueTable: glueDB.loanVariantsTable,
          rawObjectsPrefix: `${rawObjectsPrefix}loan_variant/`,
          refinedTableName: 'refined_loan_variants',
        },
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
      glueDatabase: glueDB.database,
      bucket,
      dataObjectsPrefix: refinedObjectsPrefix,
      ddbTable: table,
      logRetention,
    });
  }
}
