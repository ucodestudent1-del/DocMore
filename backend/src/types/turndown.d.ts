declare module "turndown" {
  class TurndownService {
    constructor(options?: any);
    turndown(input: string): string;
  }
  export = TurndownService;
}
