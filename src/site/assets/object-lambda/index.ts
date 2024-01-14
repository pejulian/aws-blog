import axios from "axios";
import { S3Client, WriteGetObjectResponseCommand } from "@aws-sdk/client-s3";
import { Logger } from "power";

export const handler = async (event: any, context: any) => {
  console.log("handler.event", JSON.stringify(event, undefined, 4));
  console.log("handler.context", JSON.stringify(context, undefined, 4));

  const client = new S3Client();

  const inputS3Url = event.getObjectContext?.inputS3Url;
  const requestRoute = event.getObjectContext?.outputRoute;
  const outputToken = event.getObjectContext?.outputToken;
  //   const payload = event.configuration?.payload;

  const object = await axios({
    method: "get",
    url: inputS3Url,
  });

  try {
    const command = new WriteGetObjectResponseCommand({
      Body: JSON.stringify(object.data),
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
