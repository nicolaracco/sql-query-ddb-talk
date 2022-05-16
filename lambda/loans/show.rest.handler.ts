import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const TableName = process.env.TABLE_NAME!;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

interface LoanRecord {
  id: string;
  name: string;
  loanType: string;
  rateCode: string;
  rateValue: string;
}

interface VariantRecord {
  id: string;
  ltvRatio: { min: number; max: number };
  duration: { min: number; max: number };
  spread: number;
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
    const { loan, variants } = response.Items!.reduce<{ loan?: LoanRecord; variants: VariantRecord[] }>(
      (memo, item) => {
        if (item._et === 'loan') {
          memo.loan = item as LoanRecord;
        } else {
          memo.variants.push(item as VariantRecord);
        }
        return memo;
      },
      { loan: undefined, variants: [] },
    );
    return {
      statusCode: 200,
      body: JSON.stringify({
        id,
        name: loan!.name,
        loanType: loan!.loanType,
        rateCode: loan!.rateCode,
        rateValue: loan!.rateValue,
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
