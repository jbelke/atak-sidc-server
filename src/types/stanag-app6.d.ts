declare module "stanag-app6" {
  export const app6d: Record<
    string,
    {
      name?: string;
      symbolset?: string;
      mainIcon?: Record<
        string,
        {
          Entity?: string;
          "Entity Type"?: string;
          "Entity Subtype"?: string;
          Code?: string;
          Remarks?: string;
        }
      >;
    }
  >;
  export const app6b: unknown;
}
