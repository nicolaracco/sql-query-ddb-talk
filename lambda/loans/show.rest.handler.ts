import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, QueryCommandOutput } from '@aws-sdk/lib-dynamodb';

const TableName = process.env.TABLE_NAME!;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

interface LoanRecord {
  id: string;
  name: string;
  type: string;
  rate: string;
}

interface VariantRecord {
  id: string;
  ltvRatio: { min: number; max: number };
  duration: { min: number; max: number };
  spread: number;
}

function parseQueryResponse(response: QueryCommandOutput): { loan?: LoanRecord; variants: VariantRecord[] } {
  let loan: LoanRecord | undefined;
  const variants: VariantRecord[] = [];
  for (const item of response.Items!) {
    if (item._et === 'loan') {
      loan = item as LoanRecord;
    } else {
      variants.push(item as VariantRecord);
    }
  }
  return { loan, variants };
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const id = event.pathParameters!.loanId!;
    const response = await client.send(
      new QueryCommand({
        TableName,
        KeyConditionExpression: 'PK = :PK',
        ExpressionAttributeValues: {
          ':PK': `loan#${id}`,
        },
      }),
    );
    const { loan, variants } = parseQueryResponse(response);
    if (!loan) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Loan not found',
        }),
      };
    }
    return {
      statusCode: 200,
      body: JSON.stringify({
        id,
        name: loan!.name,
        type: loan!.type,
        rate: loan!.rate,
        variants: variants.map(({ id, ltvRatio, duration, spread }) => ({ id, ltvRatio, duration, spread })),
      }),
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
