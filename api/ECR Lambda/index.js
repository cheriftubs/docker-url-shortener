const express = require('express');
const bodyParser = require('body-parser');
const AWS = require('aws-sdk');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const port = 8080;

const tableName = process.env.TABLE_NAME || "Cherif_UrlShortener";

var created = false;

app.use(cors());
app.use(bodyParser.json());


// Configure AWS DynamoDB
AWS.config.update({
  region: process.env.REGION || "eu-west-1"
});

function generateRandomString(length) {
  const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let randomString = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(charset.length);
    randomString += charset.charAt(randomIndex);
  }

  return randomString;
}

const dynamoDB = new AWS.DynamoDB();

// Create a new shortened URL
app.post('/urls', async (req, res) => {
  console.info('Incoming POST request for URL: ', req.body);
  const { url } = req.body;

  // Generate a random path for the shortened URL (you might want to use a more robust algorithm)
  const path = generateRandomString(10);

  // Check if the URL already exists in the database
  const existingUrl = await getUrlByOriginalUrl(url);

  if (existingUrl) {
    // If the URL already exists, respond with the existing shortened URL information
    res.status(200).json({
      data: {
        url,
        path: existingUrl.Path.S,
      },
    });
  } else {
    // Store the URL in DynamoDB
    const params = {
      TableName: tableName,
      Item: {
        'OriginalUrl': { S: url },
        'Path': { S: path },
        'CreatedAt': { S: new Date().toISOString() },
        'HitCount': { N: '0' },
        'Type': { S: 'URL' },
        'State': { S: 'ACTIVE' },
      },
      ConditionExpression: 'attribute_not_exists(OriginalUrl)', // Ensures that the 'OriginalUrl' does not already exist
    };

    try {
      await dynamoDB.putItem(params).promise();

      // Respond with the shortened URL information
      res.status(200).json({
        data: {
          url,
          path,
        },
      });
    } catch (error) {
      console.error('Error in DynamoDB:', error);
      // Check if the error is due to a conditional check failure (indicating duplicate entry)
      if (error.code === 'ConditionalCheckFailedException') {
        res.status(400).json({ error: 'URL already exists' });
      } else {
        res.status(500).json({ error: 'Internal Server Error' });
      }
    }
  }
});

// Get all shortened URLs
app.get('/urls', async (req, res) => {
  console.info('Incomming GET request for all URLs');
  const { url } = req.body;

  const params = {
    TableName: tableName,
  };

  try {
    const scanResults = [];
      let items;
      do {
          items = await dynamoDB.scan(params).promise();
          items.Items.forEach((item) => scanResults.push(item));
          params.ExclusiveStartKey = items.LastEvaluatedKey;
      } while (typeof items.LastEvaluatedKey !== "undefined");

    res.status(200).json({
      data: scanResults
    });
  } catch (error) {
    console.error('Error in DynamoDB:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create a table in DynamDB
app.post('/createtable', async (req, res) => {
  if (!created) {
    console.info('Creating Table in DynamoDB');
    const { param } = req.body;

    var params = {
      AttributeDefinitions: [
        {
          AttributeName: "Path", 
          AttributeType: "S"
        }
      ], 
      KeySchema: [
        {
          AttributeName: "Path", 
          KeyType: "HASH"
        }
      ], 
      ProvisionedThroughput: {
        ReadCapacityUnits: 5, 
        WriteCapacityUnits: 5
      }, 
      TableName: tableName
    };

    try {
      await dynamoDB.createTable(params).promise();

      created = true;
      res.status(201).json({"Response": "Table UrlShortener is created!"});
    } catch (error) {
      console.error('Error in DynamoDB:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  } else {
    res.status(200).json({"Response": "Table UrlShortener is already created!"});
  }
});

app.get('/api/url/:shortId', async (req, res) => {
  console.info('Incomming Get request for shortId', req.params.shortId.toLowerCase());
  res.status(200).json({});
});

app.get('/urls/:shortenedPath', async (req, res) => {
  console.info('Incomming Get request for path: ', req.params.shortenedPath.toLowerCase());

  //get item params
  const getItemParams = {
    TableName: tableName,
    Key: {
      Path: {S: req.params.shortenedPath.toLowerCase()},
    },
  };


  try {
    const getItemResult = await dynamoDB.getItem(getItemParams).promise();
    
    if (!getItemResult.Item) {
      res.status(404).json({ error: 'Shortened URL not found' });
      return;
    }

    const originalUrl = getItemResult.Item.OriginalUrl.S;
    const hitCount = Number(getItemResult.Item.HitCount.N) + 1;
    console.info("Retrieved URL: ", originalUrl);

    //update count params
    var updateCountParams = {
      ExpressionAttributeNames: {
        "#C": "HitCount"
      }, 
      ExpressionAttributeValues: {
        ":c": {
          N: hitCount.toString()
        }, 
      }, 
      Key: {
        "Path": {
          S: req.params.shortenedPath.toLowerCase()
        }, 
      }, 
      ReturnValues: "ALL_NEW", 
      TableName: tableName, 
      UpdateExpression: "SET #C = :c"
    };

    const updateCountResult = await dynamoDB.updateItem(updateCountParams).promise();

    const newHitCount = Number(updateCountResult.Attributes.HitCount.N);

    if (newHitCount != hitCount) {
      res.status(404).json({ error: 'Could not update Hit Count!' });
      return;
    }

    console.info("Updated Hit Count to: ", hitCount);

	  res.setHeader('Location', originalUrl);
    res.redirect(307, originalUrl);
  } catch (error) {
    console.error('Error retrieving URL from DynamoDB:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/urls', async (req, res) => {
  console.info('Delete all data!');

  var params = {
    TableName: tableName
   };

   try{
    await dynamoDB.deleteTable(params).promise();
    res.status(204).json({"Response": "Table UrlShortener is deleted!"});
  } catch (error) {
    console.error('Error retrieving URL from DynamoDB:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


async function getUrlByOriginalUrl(originalUrl) {
  var params = {
    ExpressionAttributeValues: {
     ":ou": {
       S: originalUrl
      }
    }, 
    FilterExpression: "OriginalUrl = :ou", 
    TableName: tableName
   };

  try {
    const result = await dynamoDB.scan(params).promise();
    if(result.Items){
      console.info('OriginalUrl ', originalUrl, ' already exists in the table.');
    }
    return result.Items[0];
  } catch (error) {
    console.error('OriginalUrl ', originalUrl, ' does not exist in the table.');
    return null;
  }
}

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
