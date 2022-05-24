import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulidx';
import Ajv, { JSONSchemaType } from 'ajv';

const TableName = process.env.TABLE_NAME!;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ajv = new Ajv();

interface RequestPayload {
  ltv: {
    min: number;
    max: number;
  };
  duration: {
    min: number;
    max: number;
  };
  spread: number;
}
const requestPayloadSchema: JSONSchemaType<RequestPayload> = {
  type: 'object',
  properties: {
    ltv: {
      type: 'object',
      properties: {
        min: { type: 'number', minimum: 0 },
        max: { type: 'number', minimum: 0 },
      },
      required: ['min', 'max'],
    },
    duration: {
      type: 'object',
      properties: {
        min: { type: 'number', minimum: 0 },
        max: { type: 'number', minimum: 0 },
      },
      required: ['min', 'max'],
    },
    spread: { type: 'number' },
  },
  required: ['ltv', 'duration', 'spread'],
  additionalProperties: false,
};
const requestPayloadValidate = ajv.compile(requestPayloadSchema);

function parsePayload(event: APIGatewayProxyEventV2): RequestPayload {
  const data = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body!, 'base64').toString() : event.body!);
  const valid = requestPayloadValidate(data);
  if (valid) {
    return data as RequestPayload;
  } else {
    console.error(requestPayloadValidate.errors);
    throw new Error('Validation failed');
  }
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const loanId = event.pathParameters!.loanId!;
    const payload = parsePayload(event);
    const id = ulid();
    await client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            ConditionCheck: {
              TableName,
              Key: {
                PK: `loan#${loanId}`,
                SK: `loan#${loanId}`,
              },
              ConditionExpression: 'attribute_exists(PK)',
            },
          },
          {
            Put: {
              TableName,
              Item: {
                PK: `loan#${loanId}`,
                SK: `loan_variant#${id}`,
                id,
                loanId,
                ...payload,
                _et: 'loan_variant',
              },
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
        ],
      }),
    );
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'success', loan_variant: { id, ...payload } }),
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
