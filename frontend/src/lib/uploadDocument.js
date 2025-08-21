// src/lib/uploadDocument.js
import { createClient } from "@supabase/supabase-js";

const BUCKET = "user-documents"; // public bucket (no RLS)

// --- build a client from env (Vite) ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail early with a helpful message
  throw new Error(
    "[Supabase] Missing env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env"
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Small util to make safe-ish file names
const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

/**
 * Upload a user document to the public bucket and return its public URL.
 * @param {Object} params
 * @param {File} params.file - File from an <input type="file" />
 * @param {string} params.userId - Namespace (email or auth uid). For public buckets this is just for organization.
 * @param {string[]} [params.allowedTypes] - Allowlist of mime types
 * @param {number} [params.maxBytes] - Size cap in bytes (default 50MB)
 * @returns {Promise<{ publicUrl: string, path: string }>}
 */
export async function uploadUserDocument({
  file,
  userId,
  allowedTypes = [
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  maxBytes = 50 * 1024 * 1024, // 50MB
}) {
  if (!file) throw new Error("No file provided");
  if (!userId) throw new Error("No userId provided");

  if (allowedTypes.length && !allowedTypes.includes(file.type)) {
    throw new Error("File type not allowed");
  }
  if (file.size > maxBytes) {
    throw new Error(
      `File too large (max ${Math.round(maxBytes / 1024 / 1024)}MB)`
    );
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
  const base = ext ? file.name.slice(0, -(ext.length + 1)) : file.name;
  const stamp = Date.now();
  const safeBase = slugify(base || "document");
  const safeExt = slugify(ext || "bin");

  // namespace by user; for public buckets this is just organizational
  const path = `${encodeURIComponent(userId)}/${stamp}-${safeBase}.${safeExt}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

  if (uploadError) throw uploadError;

  // Public bucket -> public URL
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!pub?.publicUrl) throw new Error("Could not get public URL");

  return { publicUrl: pub.publicUrl, path };
}
