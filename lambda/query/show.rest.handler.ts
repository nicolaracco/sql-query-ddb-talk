import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AthenaClient, GetQueryExecutionCommand, GetQueryResultsCommand } from '@aws-sdk/client-athena';

const athena = new AthenaClient({});

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const queryExecutionId = event.pathParameters!.id!;
    const nextToken = event.queryStringParameters?.token || undefined;

    const statusResponse = await athena.send(
      new GetQueryExecutionCommand({
        QueryExecutionId: queryExecutionId,
      }),
    );
    const status = statusResponse.QueryExecution?.Status;
    if (!status) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Query not found',
        }),
      };
    }

    const startedAt = new Date(status.SubmissionDateTime!);
    if (status.State !== 'SUCCEEDED') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          queryStatus: status.State,
          startedAt,
        }),
      };
    }
    const completedAt = new Date(status.CompletionDateTime!);
    const resultsResponse = await athena.send(
      new GetQueryResultsCommand({
        QueryExecutionId: queryExecutionId,
        NextToken: nextToken,
        MaxResults: nextToken ? 25 : 26,
      }),
    );
    const resultSet = resultsResponse.ResultSet!;

    const columnNames = resultSet.ResultSetMetadata!.ColumnInfo!.map((c) => c.Name!);
    const rows = nextToken ? resultSet.Rows! : resultSet.Rows!.slice(1);
    const results = rows.map((r) =>
      columnNames.reduce<Record<string, any>>(
        (memo, name, i) => ({
          ...memo,
          [name]: r.Data![i].VarCharValue,
        }),
        {},
      ),
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        queryStatus: status.State,
        startedAt,
        completedAt,
        executionTime: parseFloat(((completedAt.getTime() - startedAt.getTime()) / 1000).toFixed(2)),
        results,
        nextToken: resultsResponse.NextToken,
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
