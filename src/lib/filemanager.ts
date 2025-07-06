import { supabase } from "./supabase";

const uploadToSupabase = async (file: File, filePath: string) => {
    // Upload the STL file to the 'models' bucket in Supabase Storage
    const bucket = process.env.NEXT_PUBLIC_BUCKET_NAME!;
    const response = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        contentType: "application/sla", // MIME type for STL
        upsert: true, // Overwrite if file exists
      });

    if (response.error) {
    return response;
    }

    // Get the public URL for the uploaded file
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return { ...response, publicUrl: data.publicUrl };
};

export { uploadToSupabase };