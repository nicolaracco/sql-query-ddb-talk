import { Construct } from 'constructs';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as glue from '@aws-cdk/aws-glue-alpha';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as athena from 'aws-cdk-lib/aws-athena';
import { Stack } from 'aws-cdk-lib';

export interface QueryStartFunctionProps {
  workgroupName: string;
  database: glue.IDatabase;
  resultsBucket: s3.IBucket;
  dataObjectsPrefix: string;
  queryObjectsPrefix: string;
  logRetention?: logs.RetentionDays;
}

export class QueryStartFunction extends lambdaNode.NodejsFunction {
  constructor(scope: Construct, id: string, props: QueryStartFunctionProps) {
    super(scope, id, {
      entry: 'lambda/query/start.rest.handler.ts',
      logRetention: props.logRetention,
      environment: {
        WORKGROUP_NAME: props.workgroupName,
        DATABASE_NAME: props.database.databaseName,
      },
    });
    props.resultsBucket.grantRead(this, `${props.dataObjectsPrefix}*`);
    props.resultsBucket.grantReadWrite(this, `${props.queryObjectsPrefix}*`);
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['athena:StartQueryExecution', 'athena:GetPreparedStatement'],
        resources: [
          Stack.of(this).formatArn({ service: 'athena', resource: 'workgroup', resourceName: props.workgroupName }),
        ],
      }),
    );
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['glue:GetTable', 'glue:GetPartition'],
        resources: [
          props.database.catalogArn,
          props.database.databaseArn,
          Stack.of(this).formatArn({
            service: 'glue',
            resource: 'table',
            resourceName: `${props.database.databaseName}/*`,
          }),
        ],
      }),
    );

    const preparedStatementName = scope.node.addr;
    new athena.CfnPreparedStatement(this, 'PreparedStatement', {
      queryStatement: `
      SELECT l.name, ROUND(r.value + lv.spread, 2) AS rate FROM refined_loans l
      INNER JOIN (
        SELECT loanId, MIN(lv.spread) AS spread FROM refined_loan_variants lv
          WHERE lv.duration.min <= ? AND lv.duration.max >= ?
            AND lv.ltv.min <= ? AND lv.ltv.max >= ?
          GROUP BY lv.loanId
      ) AS lv ON l.id = lv.loanId
      INNER JOIN refined_rates r ON l.rate = r.id
      WHERE l.type = ?
      `,
      statementName: preparedStatementName,
      workGroup: props.workgroupName,
    });
    this.addEnvironment('PREPARED_STATEMENT_NAME', preparedStatementName);
  }

  apigwIntegration(options?: apigw.LambdaIntegrationOptions): apigw.LambdaIntegration {
    return new apigw.LambdaIntegration(this, options);
  }
}
