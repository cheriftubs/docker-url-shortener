const AWS = require('aws-sdk');

const tableName = process.env.TABLE_NAME || "UrlShortener";

AWS.config.update({
  region: process.env.REGION || "eu-west-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'DUMMYIDEXAMPLE',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'DUMMYEXAMPLEKEY',
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();

async function getShortenedUrl(shortenedPath) {
  const getItemParams = {
    TableName: tableName,
    Key: {
      Path: shortenedPath.toLowerCase(),
    },
  };

  try {
    const getItemResult = await dynamoDB.get(getItemParams).promise();

    if (!getItemResult.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Shortened URL not found' }),
      };
    }

    const originalUrl = getItemResult.Item.OriginalUrl;
    const hitCount = Number(getItemResult.Item.HitCount) + 1;

    // Update hit count
    const updateCountParams = {
      TableName: tableName,
      Key: {
        "Path": shortenedPath.toLowerCase(),
      },
      UpdateExpression: "SET HitCount = :c",
      ExpressionAttributeValues: {
        ":c": hitCount,
      },
      ReturnValues: "ALL_NEW",
    };

    const updateCountResult = await dynamoDB.update(updateCountParams).promise();
    const newHitCount = Number(updateCountResult.Attributes.HitCount);

    if (newHitCount !== hitCount) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Could not update Hit Count!' }),
      };
    }

    // Redirect
    return {
      statusCode: 307,
      headers: {
        Location: originalUrl,
      },
    };
  } catch (error) {
    console.error('Error retrieving URL from DynamoDB:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
}

exports.handler = async (event) => {
  const path = event.path || '';
  const httpMethod = event.httpMethod || '';

  if (httpMethod === 'GET' && path.startsWith('/urls/')) {
    const shortenedPath = path.substring('/urls/'.length);
    return getShortenedUrl(shortenedPath);
  }

  return {
    statusCode: 404,
    body: JSON.stringify({ error: 'Not Found' }),
  };
};
