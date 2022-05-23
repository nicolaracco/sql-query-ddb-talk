import { Construct } from 'constructs';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Stack } from 'aws-cdk-lib';

export interface QueryShowFunctionProps {
  workgroupName: string;
  resultsBucket: s3.IBucket;
  queryObjectsPrefix: string;
  logRetention?: logs.RetentionDays;
}

export class QueryShowFunction extends lambdaNode.NodejsFunction {
  constructor(scope: Construct, id: string, props: QueryShowFunctionProps) {
    super(scope, id, {
      entry: 'lambda/query/show.rest.handler.ts',
      logRetention: props.logRetention,
    });
    props.resultsBucket.grantRead(this, `${props.queryObjectsPrefix}*`);
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['athena:GetQueryResults', 'athena:GetQueryExecution'],
        resources: [
          Stack.of(this).formatArn({ service: 'athena', resource: 'workgroup', resourceName: props.workgroupName }),
        ],
      }),
    );
  }

  apigwIntegration(options?: apigw.LambdaIntegrationOptions): apigw.LambdaIntegration {
    return new apigw.LambdaIntegration(this, options);
  }
}
