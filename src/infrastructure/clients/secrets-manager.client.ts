import {
  SecretsManagerClient as Client,
  GetSecretValueCommand,
  SecretsManagerClientConfig,
} from "@aws-sdk/client-secrets-manager";

export class SecretsManagerClient {
  private readonly client: Client;

  constructor(options: SecretsManagerClientConfig = {}) {
    this.client = new Client(options);
  }

  /**
   * Obtains a secret from the Secrets Manager
   * @param id
   * @returns
   */
  async getSecret(id: string): Promise<string> {
    const { SecretString } = await this.client.send(
      new GetSecretValueCommand({ SecretId: id })
    );

    return SecretString ?? "";
  }
}
