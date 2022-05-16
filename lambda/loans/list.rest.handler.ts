import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const TableName = process.env.TABLE_NAME!;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function handler(): Promise<APIGatewayProxyResultV2> {
  try {
    const response = await client.send(
      new QueryCommand({
        TableName,
        KeyConditionExpression: 'PK = :PK AND begins_with(SK, :SK)',
        ExpressionAttributeValues: {
          ':PK': 'loan#*',
          ':SK': 'loan#',
        },
      }),
    );
    return {
      statusCode: 200,
      body: JSON.stringify(response.Items!.map(({ id, name, loanType }) => ({ id, name, loanType }))),
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
