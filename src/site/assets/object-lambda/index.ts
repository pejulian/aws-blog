import axios from "axios";
import { S3Client, WriteGetObjectResponseCommand } from "@aws-sdk/client-s3";
import { Logger, injectLambdaContext } from "@aws-lambda-powertools/logger";
import middy from "@middy/core";
import sharp from "sharp";

const logger = new Logger({});
const client = new S3Client();

const lambdaHandler = async (event: any, context: any) => {
  const inputS3Url = event.getObjectContext?.inputS3Url;
  const requestRoute = event.getObjectContext?.outputRoute;
  const outputToken = event.getObjectContext?.outputToken;
  //   const payload = event.configuration?.payload;

  const object = await axios({
    method: "get",
    url: inputS3Url,
  });

  const objectMetadata = await sharp(object.data).metadata();
  const resizeObject = await sharp(object.data)
    .resize(Math.round(objectMetadata.width! * 0.5))
    .toBuffer();

  try {
    const command = new WriteGetObjectResponseCommand({
      Body: JSON.stringify(resizeObject),
      RequestRoute: requestRoute,
      RequestToken: outputToken,
    });

    await client.send(command);

    return { status_code: 200 };
  } catch (error) {
    console.log(error);
    return { status_code: 500 };
  }
};

export const handler = middy(lambdaHandler).use(
  injectLambdaContext(logger, { logEvent: true })
);
