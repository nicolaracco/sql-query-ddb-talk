import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const TABLE_NAME = process.env.TABLE_NAME!;
const GLUE_TABLE_CODE = process.env.GLUE_TABLE_CODE!;
const REFINED_TABLE_NAME_PREFIX = process.env.REFINED_TABLE_NAME_PREFIX;

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async () => {
  const tableId = uuidv4();
  const tableName = REFINED_TABLE_NAME_PREFIX + tableId;
  const response = await client.send(
    new PutCommand({
      Item: {
        PK: `cfg#refined_name`,
        SK: GLUE_TABLE_CODE,
        _et: 'config',
        value: tableName,
        details: { tableId, tableCode: GLUE_TABLE_CODE },
      },
      TableName: TABLE_NAME,
      ReturnValues: 'ALL_OLD',
    }),
  );
  return {
    newTableName: tableName,
    oldTableName: response.Attributes?.tableName,
    oldTableExists: !!response.Attributes?.tableName,
  };
};
