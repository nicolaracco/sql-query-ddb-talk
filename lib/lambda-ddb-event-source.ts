import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export interface LambdaDDBEventSourceProps extends lambdaEventSources.DynamoEventSourceProps {
  target: lambda.IFunction;
  table: dynamodb.ITable;
  filterPatterns: any[];
}

// Needed until lambdaEventSource doesn't support the FilterCriteria option
export class LambdaDDBEventSource extends lambda.EventSourceMapping {
  constructor(scope: Construct, id: string, props: LambdaDDBEventSourceProps) {
    const { table, ...otherProps } = props;
    super(scope, id, {
      ...otherProps,
      eventSourceArn: table.tableStreamArn,
    });
    table.grantStreamRead(props.target);
    const cfnEventSourceMapping = this.node.defaultChild as lambda.CfnEventSourceMapping;
    cfnEventSourceMapping.addPropertyOverride('FilterCriteria', {
      Filters: props.filterPatterns.map((p) => ({ Pattern: JSON.stringify(p) })),
    });
  }
}
