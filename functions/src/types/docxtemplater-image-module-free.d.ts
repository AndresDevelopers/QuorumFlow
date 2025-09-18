declare module 'docxtemplater-image-module-free' {
  interface ImageModuleOptions {
    centered?: boolean;
    getImage?: (tagValue: string, tagName: string) => Buffer | Promise<Buffer>;
    getSize?: (img: Buffer, tagValue: string, tagName: string) => [number, number] | Promise<[number, number]>;
  }

  class ImageModule {
    constructor(options?: ImageModuleOptions);
  }

  export = ImageModule;
}