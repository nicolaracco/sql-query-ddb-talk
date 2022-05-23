import { Construct } from 'constructs';
import { Stack } from 'aws-cdk-lib';
import * as glue from '@aws-cdk/aws-glue-alpha';
import * as s3 from 'aws-cdk-lib/aws-s3';

export interface GlueDBProps {
  bucket: s3.IBucket;
  rawObjectsPrefix: string;
}

export class GlueDB extends Construct {
  readonly database: glue.Database;
  readonly ratesTable: glue.Table;
  readonly loansTable: glue.Table;
  readonly loanVariantsTable: glue.Table;

  constructor(scope: Construct, id: string, props: GlueDBProps) {
    super(scope, id);

    this.database = new glue.Database(this, 'DB', {
      databaseName: Stack.of(this).stackName.toLowerCase(),
    });

    this.ratesTable = new glue.Table(this, 'Rates', {
      database: this.database,
      bucket: props.bucket,
      dataFormat: glue.DataFormat.JSON,
      tableName: 'rates',
      s3Prefix: `${props.rawObjectsPrefix}rate/`,
      columns: [
        {
          name: 'id',
          type: glue.Schema.STRING,
        },
        {
          name: 'value',
          type: glue.Schema.FLOAT,
        },
      ],
    });

    this.loansTable = new glue.Table(this, 'Loans', {
      database: this.database,
      bucket: props.bucket,
      dataFormat: glue.DataFormat.JSON,
      tableName: 'loans',
      s3Prefix: `${props.rawObjectsPrefix}loan/`,
      columns: [
        {
          name: 'id',
          type: glue.Schema.STRING,
        },
        {
          name: 'name',
          type: glue.Schema.STRING,
        },
        {
          name: 'type',
          type: glue.Schema.STRING,
        },
        {
          name: 'rate',
          type: glue.Schema.STRING,
        },
      ],
    });

    this.loanVariantsTable = new glue.Table(this, 'LoanVariants', {
      database: this.database,
      bucket: props.bucket,
      dataFormat: glue.DataFormat.JSON,
      tableName: 'loan_variants',
      s3Prefix: `${props.rawObjectsPrefix}loan_variant/`,
      columns: [
        {
          name: 'id',
          type: glue.Schema.STRING,
        },
        {
          name: 'loanId',
          type: glue.Schema.STRING,
        },
        {
          name: 'spread',
          type: glue.Schema.FLOAT,
        },
        {
          name: 'duration',
          type: glue.Schema.struct([
            { name: 'min', type: glue.Schema.SMALL_INT },
            { name: 'max', type: glue.Schema.SMALL_INT },
          ]),
        },
        {
          name: 'ltv',
          type: glue.Schema.struct([
            { name: 'min', type: glue.Schema.FLOAT },
            { name: 'max', type: glue.Schema.FLOAT },
          ]),
        },
      ],
    });
  }
}
