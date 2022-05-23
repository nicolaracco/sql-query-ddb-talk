import { Construct } from 'constructs';
import * as glue from '@aws-cdk/aws-glue-alpha';
import { Duration } from 'aws-cdk-lib';
import { RemovalPolicy } from 'aws-cdk-lib';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { S3ToSfnConnector } from './s3-to-sfn-connector';

export interface StepFunctionProps {
  removalPolicy: RemovalPolicy;
  bucket: s3.IBucket;
  database: glue.IDatabase;
  ddbTable: ddb.ITable;
  refinedTableName: string;
  workgroupName: string;
}

export interface S3ConnectorProps {
  removalPolicy: RemovalPolicy;
  prefix: string;
}

export class OptimizeAthenaSfn extends Construct {
  constructor(scope: Construct, id: string, props: StepFunctionProps) {
    super(scope, id);

    const refinedTableNameGenerator = new lambdaNode.NodejsFunction(this, 'RefinedTableNameGenerator', {
      entry: 'lambda/optimize-athena/table-name-generator.handler.ts',
      environment: {
        TABLE_NAME: props.ddbTable.tableName,
        RAW_TABLE_NAME: props.rawGlueTable.tableName,
        REFINED_TABLE_NAME_PREFIX: `${props.refinedTableName}_`,
      },
    });
    props.ddbTable.grantWriteData(refinedTableNameGenerator);

    const createNewTableJob = new tasks.AthenaStartQueryExecution(this, 'CreateRefinedTable', {
      queryString: sfn.JsonPath.format(
        `CREATE TABLE "{}" WITH (format = 'Parquet') AS SELECT * FROM "${props.rawGlueTable.tableName}"`,
        sfn.JsonPath.stringAt('$.newTableName'),
      ),
      queryExecutionContext: {
        databaseName: props.database.databaseName,
      },
      workGroup: props.workgroupName,
      resultPath: sfn.JsonPath.DISCARD,
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    });

    const replaceViewJob = new tasks.AthenaStartQueryExecution(this, 'ReplaceRefinedView', {
      queryString: sfn.JsonPath.format(
        `CREATE OR REPLACE VIEW ${props.refinedTableName} AS SELECT * FROM "{}"`,
        sfn.JsonPath.stringAt('$.newTableName'),
      ),
      queryExecutionContext: {
        databaseName: props.database.databaseName,
      },
      workGroup: props.workgroupName,
      resultPath: sfn.JsonPath.DISCARD,
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    });

    const dropOldTableJob = new tasks.AthenaStartQueryExecution(this, 'DropOldRefinedTable', {
      queryString: sfn.JsonPath.format('DROP TABLE IF EXISTS `{}`', sfn.JsonPath.stringAt('$.oldTableName')),
      queryExecutionContext: {
        databaseName: props.database.databaseName,
      },
      workGroup: props.workgroupName,
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      resultPath: sfn.JsonPath.DISCARD,
    });

    const definition = sfn.Chain.start(
      new tasks.LambdaInvoke(this, 'GenerateRefinedTableName', {
        lambdaFunction: refinedTableNameGenerator,
        payloadResponseOnly: true,
      }),
    )
      .next(createNewTableJob)
      .next(replaceViewJob)
      .next(
        new sfn.Choice(this, 'OldTableExists')
          .when(sfn.Condition.booleanEquals('$.oldTableExists', true), dropOldTableJob)
          .otherwise(new sfn.Pass(this, 'IgnoreTableDrop')),
      );

    this.stateMachine = new sfn.StateMachine(this, 'StateMachine', {
      definition,
      timeout: Duration.minutes(5),
    });
  }

  private readonly stateMachine: sfn.IStateMachine;

  bindToS3Changes(bucket: s3.IBucket, { removalPolicy, prefix }: S3ConnectorProps) {
    new S3ToSfnConnector(this, 'S3ToSFN', {
      bucket,
      removalPolicy,
      stateMachine: this.stateMachine,
      prefix,
    });
  }
}
