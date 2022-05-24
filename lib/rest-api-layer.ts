import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as athena from 'aws-cdk-lib/aws-athena';
import * as glue from '@aws-cdk/aws-glue-alpha';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { DDBAccessorFunction } from './ddb-accessor-function';
import { Stack } from 'aws-cdk-lib';
import { QueryStartFunction } from './query-start-function';
import { QueryShowFunction } from './query-show-function';

export interface RESTAPILayerProps {
  glueDatabase: glue.IDatabase;
  bucket: s3.IBucket;
  dataObjectsPrefix: string;
  ddbTable: dynamodb.ITable;
  athenaProductsTableName: string;
  logRetention: logs.RetentionDays;
}

export class RESTAPILayer extends apigateway.RestApi {
  constructor(scope: Construct, id: string, props: RESTAPILayerProps) {
    super(scope, id, {
      restApiName: `${Stack.of(scope)}Rest`,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
      },
    });

    const { ddbTable, logRetention } = props;

    const apiLoans = this.root.addResource('loans');
    apiLoans.addMethod(
      'GET',
      new DDBAccessorFunction(this, 'ListLoan', {
        entry: 'lambda/loans/list.rest.handler.ts',
        table: ddbTable,
        logRetention,
      }).apigwIntegration(),
    );
    apiLoans.addMethod(
      'POST',
      new DDBAccessorFunction(this, 'CreateLoan', {
        entry: 'lambda/loans/create.rest.handler.ts',
        table: ddbTable,
        logRetention,
      }).apigwIntegration(),
    );

    const apiLoan = apiLoans.addResource('{loanId}');
    apiLoan.addMethod(
      'GET',
      new DDBAccessorFunction(this, 'ShowLoan', {
        entry: 'lambda/loans/show.rest.handler.ts',
        table: ddbTable,
        logRetention,
      }).apigwIntegration(),
    );
    apiLoan.addMethod(
      'DELETE',
      new DDBAccessorFunction(this, 'DeleteLoan', {
        entry: 'lambda/loans/delete.rest.handler.ts',
        table: ddbTable,
        logRetention,
      }).apigwIntegration(),
    );
    apiLoan.addMethod(
      'POST',
      new DDBAccessorFunction(this, 'CreateVariant', {
        entry: 'lambda/loan_variants/create.rest.handler.ts',
        table: ddbTable,
        logRetention,
      }).apigwIntegration(),
    );

    const apiVariant = apiLoan.addResource('{variantId}');
    apiVariant.addMethod(
      'DELETE',
      new DDBAccessorFunction(this, 'DeleteVariant', {
        entry: 'lambda/loan_variants/delete.rest.handler.ts',
        table: ddbTable,
        logRetention,
      }).apigwIntegration(),
    );

    const apiRates = this.root.addResource('rates');
    apiRates.addMethod(
      'GET',
      new DDBAccessorFunction(this, 'ListRates', {
        entry: 'lambda/rates/list.rest.handler.ts',
        table: ddbTable,
        logRetention,
      }).apigwIntegration(),
    );
    apiRates.addMethod(
      'POST',
      new DDBAccessorFunction(this, 'UpsertRate', {
        entry: 'lambda/rates/upsert.rest.handler.ts',
        table: ddbTable,
        logRetention,
      }).apigwIntegration(),
    );

    const workgroupName = `${Stack.of(this).stackName}Queries`;
    const queriesPrefix = 'queries/';
    new athena.CfnWorkGroup(this, 'QueryWorkgroup', {
      name: workgroupName,
      workGroupConfiguration: {
        resultConfiguration: {
          outputLocation: props.bucket.s3UrlForObject(queriesPrefix),
        },
      },
      recursiveDeleteOption: true,
    });

    const queries = this.root.addResource('queries');
    queries.addMethod(
      'POST',
      new QueryStartFunction(this, 'StartQuery', {
        database: props.glueDatabase,
        workgroupName,
        resultsBucket: props.bucket,
        dataObjectsPrefix: props.dataObjectsPrefix,
        queryObjectsPrefix: queriesPrefix,
        athenaProductsTableName: props.athenaProductsTableName,
        logRetention,
      }).apigwIntegration(),
    );
    const query = queries.addResource('{id}');
    query.addMethod(
      'GET',
      new QueryShowFunction(this, 'ShowQuery', {
        workgroupName,
        resultsBucket: props.bucket,
        queryObjectsPrefix: queriesPrefix,
        logRetention,
      }).apigwIntegration(),
    );
  }
}
