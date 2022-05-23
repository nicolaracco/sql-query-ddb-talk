import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as glue from '@aws-cdk/aws-glue-alpha';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';
import * as athena from 'aws-cdk-lib/aws-athena';
import { OptimizeAthenaSfn } from './optimize-athena-sfn';

export interface OptimizeAthenaProps {
  removalPolicy: RemovalPolicy;
  bucket: s3.IBucket;
  database: glue.IDatabase;
  ddbTable: ddb.ITable;
  refinedObjectsPrefix: string;
  tables: {
    [key: string]: {
      glueTable: glue.ITable;
      rawObjectsPrefix: string;
      refinedTableName: string;
    };
  };
}

export class OptimizeAthena extends Construct {
  constructor(scope: Construct, id: string, props: OptimizeAthenaProps) {
    super(scope, id);

    const { removalPolicy } = props;

    const workgroupName = `${Stack.of(this)}Optimization`;
    new athena.CfnWorkGroup(this, 'Workgroup', {
      name: workgroupName,
      workGroupConfiguration: {
        resultConfiguration: {
          outputLocation: props.bucket.s3UrlForObject(props.refinedObjectsPrefix),
        },
      },
      recursiveDeleteOption: true,
    });

    for (const [tableId, tableInfo] of Object.entries(props.tables)) {
      const sfn = new OptimizeAthenaSfn(this, tableId, {
        bucket: props.bucket,
        database: props.database,
        rawGlueTable: tableInfo.glueTable,
        refinedTableName: tableInfo.refinedTableName,
        ddbTable: props.ddbTable,
        removalPolicy,
        workgroupName,
      });
      sfn.bindToS3Changes(props.bucket, { removalPolicy, prefix: tableInfo.rawObjectsPrefix });
    }
  }
}
