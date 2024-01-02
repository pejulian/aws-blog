import { Context } from "aws-lambda";

export type ParseContextResponse = Readonly<{
  functionName: string;
  region: string;
  viewerRequestRegion: string;
}>;

export class LambdaUtils {
  private parseContext(context: Context): ParseContextResponse {
    const functionArnParts = context.invokedFunctionArn.split(":");
    const [functionRegion, functionName] = functionArnParts[6].split(".");
    return {
      region: functionRegion,
      functionName,
      viewerRequestRegion: functionArnParts[3],
    } as ParseContextResponse;
  }

  getFunctionNameFromContext(context: Context): string {
    return this.parseContext(context).functionName;
  }

  getRegionFromContext(context: Context): string {
    return this.parseContext(context).region;
  }
}
