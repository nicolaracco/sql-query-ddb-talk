import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const TableName = process.env.TABLE_NAME!;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const loanId = event.pathParameters!.loanId!;
    const id = event.pathParameters!.variantId!;
    await client.send(
      new DeleteCommand({
        TableName,
        Key: {
          PK: `loan#${loanId}`,
          SK: `loan_variant#${id}`,
        },
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
