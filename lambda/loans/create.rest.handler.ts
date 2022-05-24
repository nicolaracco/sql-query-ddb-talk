import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulidx';
import Ajv, { JSONSchemaType } from 'ajv';

const TableName = process.env.TABLE_NAME!;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ajv = new Ajv();

interface RequestPayload {
  name: string;
  type: string;
  rate: string;
}
const requestPayloadSchema: JSONSchemaType<RequestPayload> = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    type: { type: 'string', enum: ['FIXED', 'VARIABLE'] },
    rate: { type: 'string' },
  },
  required: ['name', 'type', 'rate'],
  additionalProperties: false,
};
const requestPayloadValidate = ajv.compile(requestPayloadSchema);

function parsePayload(event: APIGatewayProxyEvent): RequestPayload {
  const data = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body!, 'base64').toString() : event.body!);
  const valid = requestPayloadValidate(data);
  if (valid) {
    return data as RequestPayload;
  } else {
    console.error(requestPayloadValidate.errors);
    throw new Error('Validation failed');
  }
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const payload = parsePayload(event);
    const id = ulid();
    const fullId = `loan#${id}`;
    const rateFullId = `rate#${payload.rate}`;
    await client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            ConditionCheck: {
              TableName,
              Key: {
                PK: rateFullId,
                SK: rateFullId,
              },
              ConditionExpression: 'attribute_exists(PK)',
            },
          },
          {
            Put: {
              TableName,
              Item: {
                PK: fullId,
                SK: fullId,
                id,
                ...payload,
                _et: 'loan',
                GSI1PK: 'loans',
                GSI1SK: fullId,
              },
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
        ],
      }),
    );
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'success', loan: { id, ...payload } }),
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
