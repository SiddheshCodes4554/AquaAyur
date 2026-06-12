import { supabase } from './supabase';

/**
 * Upload a local meal photo URI to Supabase Storage 'meals' bucket.
 * Converts URI to a binary Blob and uploads it to user-scoped folder.
 *
 * @param localUri Local file URI from camera or gallery
 * @param userId Current user ID (used to scope directory path)
 * @returns Public URL of the uploaded image asset
 */
export async function uploadMealImage(localUri: string, userId: string): Promise<string> {
  try {
    // 1. Fetch file contents and convert to Blob binary
    const response = await fetch(localUri);
    const blob = await response.blob();

    // 2. Generate a random unique file name
    const fileExtension = localUri.split('.').pop() || 'jpg';
    const uniqueId = Math.random().toString(36).substring(2, 9);
    const fileName = `${Date.now()}-${uniqueId}.${fileExtension}`;
    const filePath = `${userId}/${fileName}`;

    // 3. Upload binary to Supabase Storage Bucket
    const { data, error } = await supabase.storage
      .from('meals')
      .upload(filePath, blob, {
        contentType: `image/${fileExtension === 'png' ? 'png' : 'jpeg'}`,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(`Supabase Storage upload error: ${error.message}`);
    }

    // 4. Retrieve and return public URL
    const { data: urlData } = supabase.storage
      .from('meals')
      .getPublicUrl(filePath);

    if (!urlData || !urlData.publicUrl) {
      throw new Error('Failed to retrieve public URL of the uploaded image');
    }

    return urlData.publicUrl;
  } catch (error: any) {
    console.error('[ImageUpload] Failed to upload meal image:', error);
    throw new Error(error.message || 'Image upload failed. Ensure connection is stable.');
  }
}
