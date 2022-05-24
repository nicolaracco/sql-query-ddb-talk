import { APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const TableName = process.env.TABLE_NAME!;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function handler(): Promise<APIGatewayProxyResult> {
  try {
    const response = await client.send(
      new QueryCommand({
        TableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :GSI1PK',
        ExpressionAttributeValues: {
          ':GSI1PK': 'loans',
        },
        Select: 'SPECIFIC_ATTRIBUTES',
        ProjectionExpression: 'id, #name, #type, rate',
        ExpressionAttributeNames: {
          '#name': 'name',
          '#type': 'type',
        },
      }),
    );
    return {
      statusCode: 200,
      body: JSON.stringify(response.Items!.map(({ id, name, type, rate }) => ({ id, name, type, rate }))),
    };
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal error',
      }),
    };
  }
}
