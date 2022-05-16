import { Construct } from 'constructs';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';

export interface DDBAccessorFunctionProps {
  table: dynamodb.ITable;
  entry: string;
  logRetention?: logs.RetentionDays;
}

export class DDBAccessorFunction extends lambdaNode.NodejsFunction {
  constructor(scope: Construct, id: string, props: DDBAccessorFunctionProps) {
    super(scope, id, {
      entry: props.entry,
      logRetention: props.logRetention,
      environment: {
        TABLE_NAME: props.table.tableName,
      },
    });
    props.table.grantReadWriteData(this);
  }

  apigwIntegration(options?: apigw.LambdaIntegrationOptions): apigw.LambdaIntegration {
    return new apigw.LambdaIntegration(this, options);
  }
}
