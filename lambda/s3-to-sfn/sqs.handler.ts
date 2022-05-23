import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';

const stateMachineArn = process.env.STATE_MACHINE_ARN;
const client = new SFNClient({});
const command = new StartExecutionCommand({
  stateMachineArn: stateMachineArn,
});

export const handler = () => client.send(command);
