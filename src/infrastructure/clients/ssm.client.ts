import {
  SSMClient as Client,
  GetParameterCommand,
  SSMClientConfig,
} from "@aws-sdk/client-ssm";

export class SSMClient {
  private readonly client: Client;

  constructor(options: SSMClientConfig = {}) {
    this.client = new Client(options);
  }

  /**
   * Obtains a parameter by its name from the SSM Parameter Store
   * @param name
   * @param withDecryption
   * @returns
   */
  async getParameterValue(
    name: string,
    withDecryption: boolean = false
  ): Promise<string> {
    // console.log("getting parameter", name);
    const { Parameter } = await this.client.send(
      new GetParameterCommand({ Name: name, WithDecryption: withDecryption })
    );

    return Parameter?.Value ?? "";
  }
}
