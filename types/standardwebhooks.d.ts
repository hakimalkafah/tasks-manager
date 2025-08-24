declare module "standardwebhooks" {
    export class Webhook {
      constructor(secret: string);
      verify(
        payload: string,
        headers:
          | string
          | {
              "svix-id": string;
              "svix-timestamp": string;
              "svix-signature": string;
            }
          | Record<string, string>
      ): any;
    }
  }