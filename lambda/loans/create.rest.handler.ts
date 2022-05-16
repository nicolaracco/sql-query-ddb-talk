import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulidx';
import Ajv, { JSONSchemaType } from 'ajv';

const TableName = process.env.TABLE_NAME!;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ajv = new Ajv();

interface RequestPayload {
  name: string;
  loanType: string;
  rateCode: string;
  rateValue: number;
}
const requestPayloadSchema: JSONSchemaType<RequestPayload> = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    loanType: { type: 'string', enum: ['FIXED', 'VARIABLE'] },
    rateCode: { type: 'string' },
    rateValue: { type: 'number' },
  },
  required: ['name', 'loanType', 'rateCode', 'rateValue'],
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
    const payload = parsePayload(event);
    const id = ulid();
    const fullId = `loan#${id}`;
    await client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName,
              Item: {
                PK: `loan#*`,
                SK: fullId,
                id,
                name: payload.name,
                loanType: payload.loanType,
                _et: 'loan_item',
              },
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
