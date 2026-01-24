/**
 * File Helper Utilities
 * Utilities for handling file operations, including base64 conversion
 */

/**
 * Convert a File object to base64 string
 * @param file - The file to convert
 * @returns Promise that resolves to base64 string (without data URL prefix)
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Convert a Blob to base64 string
 * @param blob - The blob to convert
 * @returns Promise that resolves to base64 string (without data URL prefix)
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Validate if a file is an image
 * @param filename - The filename to validate
 * @returns true if the file is an image
 */
export function validateImageFile(filename: string): boolean {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return allowedExtensions.includes(ext);
}

/**
 * Validate file size
 * @param base64 - The base64 string to validate
 * @param maxSizeInMB - Maximum size in megabytes
 * @returns true if the file size is within the limit
 */
export function validateFileSize(base64: string, maxSizeInMB: number = 5): boolean {
  // base64 is ~33% larger than the original file
  const sizeInBytes = (base64.length * 3) / 4;
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  return sizeInBytes <= maxSizeInBytes;
}

/**
 * Get file size in MB from base64 string
 * @param base64 - The base64 string
 * @returns File size in megabytes
 */
export function getFileSizeInMB(base64: string): number {
  const sizeInBytes = (base64.length * 3) / 4;
  return sizeInBytes / (1024 * 1024);
}

/**
 * Format file size for display
 * @param sizeInMB - Size in megabytes
 * @returns Formatted string (e.g., "2.5 MB")
 */
export function formatFileSize(sizeInMB: number): string {
  if (sizeInMB < 1) {
    return `${(sizeInMB * 1024).toFixed(0)} KB`;
  }
  return `${sizeInMB.toFixed(2)} MB`;
}

/**
 * Get file extension from filename
 * @param filename - The filename
 * @returns File extension (e.g., ".jpg")
 */
export function getFileExtension(filename: string): string {
  return filename.toLowerCase().substring(filename.lastIndexOf('.'));
}

/**
 * Generate a unique filename
 * @param originalFilename - The original filename
 * @param prefix - Optional prefix for the filename
 * @returns Unique filename with timestamp
 */
export function generateUniqueFilename(originalFilename: string, prefix?: string): string {
  const ext = getFileExtension(originalFilename);
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);

  if (prefix) {
    return `${prefix}_${timestamp}_${randomStr}${ext}`;
  }

  return `file_${timestamp}_${randomStr}${ext}`;
}
