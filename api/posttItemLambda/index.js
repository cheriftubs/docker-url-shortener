const AWS = require('aws-sdk');
const crypto = require('crypto');

const tableName = process.env.TABLE_NAME || "UrlShortener";

AWS.config.update({
  region: process.env.REGION || "eu-west-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'DUMMYIDEXAMPLE',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'DUMMYEXAMPLEKEY',
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();

function generateRandomString(length) {
  const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let randomString = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(charset.length);
    randomString += charset.charAt(randomIndex);
  }

  return randomString;
}

async function createShortenedUrl(url) {
  // Generate a random path for the shortened URL (you might want to use a more robust algorithm)
  const path = generateRandomString(10);

  // Store the URL in DynamoDB
  const params = {
    TableName: tableName,
    Item: {
      'OriginalUrl': url,
      'Path': path,
      'CreatedAt': new Date().toISOString(),
      'HitCount': 0,
      'Type': 'URL',
      'State': 'ACTIVE',
    },
    ConditionExpression: 'attribute_not_exists(OriginalUrl)', // Ensures that the 'OriginalUrl' does not already exist
  };

  try {
    await dynamoDB.put(params).promise();

    // Respond with the shortened URL information
    return {
      statusCode: 200,
      body: JSON.stringify({
        data: {
          url,
          path,
        },
      }),
    };
  } catch (error) {
    console.error('Error in DynamoDB:', error);
    // Check if the error is due to a conditional check failure (indicating duplicate entry)
    if (error.code === 'ConditionalCheckFailedException') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'URL already exists' }),
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal Server Error' }),
      };
    }
  }
}

exports.handler = async (event) => {
  const httpMethod = event.httpMethod || '';

  if (httpMethod === 'POST') {
    const { url } = JSON.parse(event.body || '{}');
    return createShortenedUrl(url);
  }

  return {
    statusCode: 404,
    body: JSON.stringify({ error: 'Not Found' }),
  };
};
