import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import Ajv, { JSONSchemaType } from 'ajv';

const TableName = process.env.TABLE_NAME!;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ajv = new Ajv();

interface RequestPayload {
  code: string;
  value: number;
}
const requestPayloadSchema: JSONSchemaType<RequestPayload> = {
  type: 'object',
  properties: {
    code: { type: 'string' },
    value: { type: 'number' },
  },
  required: ['code', 'value'],
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
    const fullId = `rate#${payload.code}`;
    await client.send(
      new PutCommand({
        TableName,
        Item: {
          PK: fullId,
          SK: fullId,
          id: payload.code,
          value: payload.value,
          _et: 'rate',
          GSI1PK: 'rates',
          GSI1SK: fullId,
        },
      }),
    );
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'success', rete: payload }),
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
