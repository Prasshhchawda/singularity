import { supabase } from "./supabase";

const INBOX_BUCKET = "singularity-inbox";
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export type ReceivedFile = {
  id: string;
  filename: string;
  client_name: string;
  content_type: string;
  size_bytes: number;
  storage_path: string;
  received_at: string;
  status: "received" | "archived";
  assigned_agent: string | null;
  is_read: boolean;
};

export async function fetchReceivedFiles() {
  const { data, error } = await supabase
    .from("received_files")
    .select("*")
    .order("received_at", { ascending: false });

  if (error) throw new Error("Inbox could not be loaded.");
  return (data ?? []) as ReceivedFile[];
}

export async function uploadReceivedFile(file: File, clientName: string) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Choose a file smaller than 50 MB.");
  }

  const storagePath = `${Date.now()}-${file.name}`;
  const contentType = file.type || "application/octet-stream";
  const { error: uploadError } = await supabase.storage
    .from(INBOX_BUCKET)
    .upload(storagePath, file, { contentType, upsert: false });

  if (uploadError) throw new Error("Your file could not be sent. Please try again.");

  const { error: recordError } = await supabase.from("received_files").insert({
    filename: file.name,
    client_name: clientName.trim(),
    content_type: contentType,
    size_bytes: file.size,
    storage_path: storagePath,
  });

  if (recordError) {
    await supabase.storage.from(INBOX_BUCKET).remove([storagePath]);
    throw new Error("Your file could not be sent. Please try again.");
  }
}

export async function updateReceivedFile(
  id: string,
  changes: Partial<Pick<ReceivedFile, "status" | "assigned_agent" | "is_read">>,
) {
  const { error } = await supabase.from("received_files").update(changes).eq("id", id);

  if (error) throw new Error("That change could not be saved.");
}

export async function createReceivedFileUrl(
  storagePath: string,
  filename: string,
  download = false,
) {
  const { data, error } = await supabase.storage
    .from(INBOX_BUCKET)
    .createSignedUrl(storagePath, 300, download ? { download: filename } : undefined);

  if (error || !data?.signedUrl) throw new Error("This file could not be opened.");
  return data.signedUrl;
}

export async function deleteReceivedFile(file: ReceivedFile) {
  const { error: storageError } = await supabase.storage
    .from(INBOX_BUCKET)
    .remove([file.storage_path]);

  if (storageError) throw new Error("This file could not be deleted.");

  const { error: recordError } = await supabase.from("received_files").delete().eq("id", file.id);

  if (recordError) throw new Error("This file could not be deleted.");
}
