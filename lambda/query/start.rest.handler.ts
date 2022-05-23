import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AthenaClient, StartQueryExecutionCommand } from '@aws-sdk/client-athena';
import Ajv, { JSONSchemaType } from 'ajv';

const WORKGROUP_NAME = process.env.WORKGROUP_NAME!;
const DATABASE_NAME = process.env.DATABASE_NAME!;
const PREPARED_STATEMENT_NAME = process.env.PREPARED_STATEMENT_NAME!;

const athena = new AthenaClient({});
const ajv = new Ajv();

interface RequestPayload {
  duration: number;
  propertyValue: number;
  loanValue: number;
  loanType: string;
}
const requestPayloadSchema: JSONSchemaType<RequestPayload> = {
  type: 'object',
  properties: {
    duration: { type: 'integer' },
    propertyValue: { type: 'integer' },
    loanValue: { type: 'integer' },
    loanType: { type: 'string', enum: ['FIXED', 'VARIABLE'] },
  },
  required: ['duration', 'propertyValue', 'loanValue', 'loanType'],
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
    const ltvRatio = parseFloat((payload.loanValue / payload.propertyValue).toFixed(2));
    const startResponse = await athena.send(
      new StartQueryExecutionCommand({
        WorkGroup: WORKGROUP_NAME,
        QueryString: `EXECUTE ${PREPARED_STATEMENT_NAME} USING ${payload.duration}, ${payload.duration}, ${ltvRatio}, ${ltvRatio}, '${payload.loanType}'`,
        QueryExecutionContext: {
          Database: DATABASE_NAME,
        },
      }),
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        executionId: startResponse.QueryExecutionId,
        query: {
          loanType: payload.loanType,
          duration: payload.duration,
          ltvRatio,
        },
      }),
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
