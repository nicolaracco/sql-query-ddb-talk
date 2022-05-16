import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

const TableName = process.env.TABLE_NAME!;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const id = event.pathParameters!.loanId!;
    const fullId = `loan#${id}`;
    await client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Delete: {
              TableName,
              Key: {
                PK: 'loan#*',
                SK: fullId,
              },
            },
          },
          {
            Delete: {
              TableName,
              Key: {
                PK: fullId,
                SK: fullId,
              },
            },
          },
        ],
      }),
    );
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'success' }),
    };
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: (e as Error).message,
      }),
    };
  }
}
