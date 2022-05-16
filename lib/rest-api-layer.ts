import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';
import { DDBAccessorFunction } from './ddb-accessor-function';
import { Stack } from 'aws-cdk-lib';

export interface RESTAPILayerProps {
  table: dynamodb.ITable;
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

    const { table, logRetention } = props;

    const apiLoans = this.root.addResource('loans');
    apiLoans.addMethod(
      'GET',
      new DDBAccessorFunction(this, 'ListLoan', {
        entry: 'lambda/loans/list.rest.handler.ts',
        table,
        logRetention,
      }).apigwIntegration(),
    );
    apiLoans.addMethod(
      'POST',
      new DDBAccessorFunction(this, 'CreateLoan', {
        entry: 'lambda/loans/create.rest.handler.ts',
        table,
        logRetention,
      }).apigwIntegration(),
    );

    const apiLoan = apiLoans.addResource('{loanId}');
    apiLoan.addMethod(
      'GET',
      new DDBAccessorFunction(this, 'ShowLoan', {
        entry: 'lambda/loans/show.rest.handler.ts',
        table,
        logRetention,
      }).apigwIntegration(),
    );
    apiLoan.addMethod(
      'DELETE',
      new DDBAccessorFunction(this, 'DeleteLoan', {
        entry: 'lambda/loans/delete.rest.handler.ts',
        table,
        logRetention,
      }).apigwIntegration(),
    );
    apiLoan.addMethod(
      'POST',
      new DDBAccessorFunction(this, 'CreateVariant', {
        entry: 'lambda/loan_variants/create.rest.handler.ts',
        table,
        logRetention,
      }).apigwIntegration(),
    );

    const apiVariant = apiLoan.addResource('{variantId}');
    apiVariant.addMethod(
      'DELETE',
      new DDBAccessorFunction(this, 'DeleteVariant', {
        entry: 'lambda/loan_variants/delete.rest.handler.ts',
        table,
        logRetention,
      }).apigwIntegration(),
    );
  }
}
