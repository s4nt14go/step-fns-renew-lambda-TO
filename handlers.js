import 'source-map-support/register';
const Promise = require('bluebird');
const AWS = require('aws-sdk');
const SES = new AWS.SES();

/* Example input data to step function
{
  "rangeToProcess": [1, 12]
}*/

export const processItem = async (event, context) => {
  console.log('event', event);
  let { TASK_TAKES } = process.env;
  TASK_TAKES |= 1;  // How much seconds take processing an item

  const alertNearTO = 3;  // How many seconds before TO will alert
  let to = setTimeout(async () => {
    console.log('Sending email because of near TO');
    await sendEmail('Close to TO', `Lambda will timeout in ${alertNearTO}s`);
  }, context.getRemainingTimeInMillis() - alertNearTO * 1000);

  const { rangeToProcess } = event;

  const endId = rangeToProcess[1];
  let nextId = event.nextId || rangeToProcess[0];

  try {
    await Promise.delay(TASK_TAKES * 1000);
    console.log(`Item ${nextId} processed`);
    nextId++;

    let ret;
    if (nextId <= endId) {
      ret = {
        done: false,
        nextId
      };
      ret = {
        done: false,
        nextId,
        rangeToProcess,
      };
    } else {
      ret = {
        done: true
      };
    }
    console.log('return', ret);
    clearTimeout(to);
    return ret;
  } catch (err) {
    clearTimeout(to);
    throw err;
  }
};

export const batchEnded = async (event, context) => {
  console.log("event", event);
  await sendEmail('End reached');
  return event;
};

async function sendEmail(subject, body = '') {
  let { EMAIL, AWS_LAMBDA_FUNCTION_NAME } = process.env;
  if (!EMAIL) return console.log(`Email is not sent as EMAIL environmental variable wasn't found`);
  const lambdaName = AWS_LAMBDA_FUNCTION_NAME.split('-').slice(-1);  // AWS_LAMBDA_FUNCTION_NAME is step-fns-renew-lambda-to-dev-<function>

  const d = new Date();
  console.log('d', d);
  const params = {
    Destination: {
      ToAddresses: [ EMAIL ]
    },
    Message: {
      Body: {
        Text: { Data: `Date: ${d}\n${body}` }
      },
      Subject: { Data: `${lambdaName} ${subject} ${d}` }
    },
    Source: EMAIL
  };
  try {
    const resp = await SES.sendEmail(params).promise();
    console.log('sendEmail resp', resp);
  } catch (e) {
    console.log('Error sending email', e);
  }
}
