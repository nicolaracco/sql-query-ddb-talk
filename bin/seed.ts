import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import * as _ from 'lodash';
import axios from 'axios';

type LoanType = 'FIXED' | 'VARIABLE';

interface LoanRequest {
  name: string;
  type: LoanType;
  rate: string;
}

interface LoanVariantRequest {
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

interface LoanSeededData {
  loan: LoanRequest;
  variants: LoanVariantRequest[];
}

const STACK_NAME = 'LoansFinder';
const client = new CloudFormationClient({});

const NAME_BRAND_WORDS = [
  ['Domus', 'Home', 'Casa', 'House', 'Baracca', 'PerTe', 'PerVoi', 'Mutuo', 'Loan'],
  [
    'Red',
    'Rosso',
    'Green',
    'Verde',
    'Yellow',
    'Giallo',
    'Black',
    'Nero',
    'Gray',
    'Grigio',
    'White',
    'Bianco',
    'Intesi',
    'Credici',
  ],
];
const LOAN_TYPES: { code: LoanType; words: string[] }[] = [
  { code: 'FIXED', words: ['Fixed', 'Fisso', 'Stabile', 'Costante', 'Affidabile'] },
  { code: 'VARIABLE', words: ['Variabile', 'Dinamico', 'Dynamic', 'Giovane'] },
];
const RATES: Record<LoanType, { code: string; value: number }[]> = {
  FIXED: [
    { code: 'IRS_1Y', value: 0.4 },
    { code: 'IRS_2Y', value: 0.96 },
    { code: 'IRS_3Y', value: 1.16 },
    { code: 'IRS_4Y', value: 1.29 },
    { code: 'IRS_5Y', value: 1.38 },
    { code: 'IRS_6Y', value: 1.46 },
    { code: 'IRS_7Y', value: 1.52 },
    { code: 'IRS_8Y', value: 1.58 },
    { code: 'IRS_9Y', value: 1.64 },
    { code: 'IRS_10Y', value: 1.7 },
  ],
  VARIABLE: [
    { code: 'EURIBOR_1M', value: -0.535 },
    { code: 'EURIBOR_3M', value: -0.348 },
    { code: 'EURIBOR_6M', value: -0.078 },
    { code: 'EURIBOR_12M', value: 0.353 },
  ],
};

async function findRestEndpoint(): Promise<string> {
  const describeResponse = await client.send(
    new DescribeStacksCommand({
      StackName: STACK_NAME,
    }),
  );
  return describeResponse.Stacks![0].Outputs!.find(({ OutputKey }) => OutputKey!.startsWith('RestEndpoint'))!
    .OutputValue!;
}

function generateLoanData(): LoanSeededData {
  const words = NAME_BRAND_WORDS.map((words) => _.sample(words));
  const loanType = _.sample(LOAN_TYPES)!;
  words.push(_.sample(loanType.words));
  const rateType = _.sample(RATES[loanType.code])!;

  const loan: LoanRequest = {
    name: _.shuffle(words).join(' '),
    type: loanType.code,
    rate: rateType.code,
  };

  const variantsCount = 5;

  const ltvMin = _.random(0.1, 0.4, true);
  const ltvMax = _.random(ltvMin + 0.4, 1, true);
  const ltvDelta = (ltvMax - ltvMin) / variantsCount;

  const durationMin = _.random(10);
  const durationMax = _.random(durationMin + 15, 40);
  const durationHalf = Math.round((durationMax - durationMin) / 2);
  const durations = [
    {
      min: durationMin,
      max: durationMin + durationHalf,
    },
    {
      min: durationMin + durationHalf,
      max: durationMax,
    },
  ];

  let spread = _.random(0.2, 1, true);
  const spreadDelta = _.random(0.1, 0.2, true);

  const variants = [];
  for (const duration of durations) {
    for (let i = 0; i < 5; i++) {
      variants.push({
        ltv: {
          min: parseFloat((ltvMin + ltvDelta * i).toFixed(1)),
          max: parseFloat((ltvMin + ltvDelta * (i + 1)).toFixed(1)),
        },
        duration,
        spread: parseFloat((spread + i * spreadDelta).toFixed(2)),
      });
    }
    spread += spreadDelta;
  }

  return { loan, variants };
}

async function seedLoan(endpoint: string, { loan, variants }: LoanSeededData): Promise<void> {
  const loanResponse = await axios.post(`${endpoint}loans`, loan);
  const id = loanResponse.data.loan.id;
  console.log(`-> Generated loan ${id}`);
  for (const variant of variants) {
    const variantResponse = await axios.post(`${endpoint}loans/${id}`, variant);
    console.log(`->   Generated variant ${variantResponse.data.loan_variant.id}`);
  }
}

async function seedRates(endpoint: string): Promise<void> {
  for (const loanType of LOAN_TYPES) {
    const rates = RATES[loanType.code];
    for (const rate of rates) {
      await axios.post(`${endpoint}rates`, rate);
    }
  }
}

async function main() {
  console.log('Finding REST Endpoint...');
  const endpoint = await findRestEndpoint();
  console.log(`-> Found: ${endpoint}`);

  await seedRates(endpoint);

  const loansCount = _.random(10);
  for (let i = 0; i < loansCount; i++) {
    console.log(`-> Generating loan...`);
    await seedLoan(endpoint, generateLoanData());
  }
}

main().catch(console.error);
