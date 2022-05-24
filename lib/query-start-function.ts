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
  athenaProductsTableName: string;
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
      SELECT p.id, p.name, MIN(p.rate) AS rate FROM "${props.athenaProductsTableName}" p
        WHERE p.duration.min <= ? AND p.duration.max >= ?
          AND p.ltv.min <= ? AND p.ltv.max >= ?
          AND p.type = ?
      GROUP BY p.id, p.name`,
      statementName: preparedStatementName,
      workGroup: props.workgroupName,
    });
    this.addEnvironment('PREPARED_STATEMENT_NAME', preparedStatementName);
  }

  apigwIntegration(options?: apigw.LambdaIntegrationOptions): apigw.LambdaIntegration {
    return new apigw.LambdaIntegration(this, options);
  }
}
