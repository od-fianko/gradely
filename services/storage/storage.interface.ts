// Abstraction for file storage.
// Currently implemented with Vercel Blob. Swap by implementing this interface.

export type UploadInput = {
  filename: string;
  contentType: string;
  data: Buffer | Blob;
};

export type UploadOutput = {
  url: string;
  storedFilename: string;
  sizeBytes: number;
};

export interface IFileStorage {
  upload(input: UploadInput): Promise<UploadOutput>;
  delete(url: string): Promise<void>;
  getSignedUrl?(storedFilename: string, expiresInSeconds: number): Promise<string>;
}
