export type FileSubmissionInput = {
  file: File;
};

export type UploadedFile = {
  fileName: string;
  originalName: string;
  fileUrl: string;
  fileType: string;
  fileSizeBytes: number;
};

export const ALLOWED_FILE_TYPES = ["pdf", "docx", "pptx", "xlsx", "zip", "txt"] as const;
export type AllowedFileType = (typeof ALLOWED_FILE_TYPES)[number];
