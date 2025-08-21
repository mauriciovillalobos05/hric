import React, { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { CheckCircle, Eye, Upload, Pencil } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

/**
 * Props:
 * - enterpriseId?: uuid string (optional)
 * - bucket?: string (default: "user-documents")
 * - maxSizeMb?: number (default: 25)
 */
export default function DocumentStatus({
  enterpriseId = null,
  bucket = "user-documents",
  maxSizeMb = 25,
}) {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [editingDocId, setEditingDocId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(null);

  // --- Helpers -------------------------------------------------------------

  const fetchSignedUrl = async (path) => {
    // Prefer signed URL in non-public buckets
    const { data, error: urlErr } = await supabase
      .storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60); // 1 hour
    if (urlErr) return null;
    return data?.signedUrl || null;
  };

  const listMyDocs = useCallback(async () => {
    if (!userId) return;
    const { data, error: docsErr } = await supabase
      .from("document")
      .select("*")
      .eq("uploaded_by", userId)        // <-- schema-correct
      .order("uploaded_at", { ascending: false }); // your schema has uploaded_at
    if (docsErr) {
      setError(docsErr.message);
      return;
    }
    setDocuments(data || []);
  }, [userId]);

  // --- Load current user + their documents --------------------------------

  useEffect(() => {
    (async () => {
      setError(null);
      const { data: { user }, error: uErr } = await supabase.auth.getUser();
      if (uErr) { setError(uErr.message); return; }
      if (!user) { setError("Not authenticated."); return; }
      setUserId(user.id);
    })();
  }, []);

  useEffect(() => { listMyDocs(); }, [listMyDocs]);

  // --- Upload (PDF only) ---------------------------------------------------

  const onDrop = useCallback(async (accepted) => {
    setError(null);
    if (!userId) { setError("Not authenticated."); return; }
    if (!accepted?.length) return;

    const file = accepted[0];
    // Basic client validation
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF file.");
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`File is too large. Max ${maxSizeMb}MB.`);
      return;
    }

    try {
      setUploading(true);
      // Storage path: optionally include enterprise folder if provided
      const safeName = file.name.replace(/\s+/g, "_");
      const filePath = `${enterpriseId || "user"}/${userId}/${Date.now()}-${safeName}`;

      // Upload to Storage
      const { error: upErr } = await supabase
        .storage
        .from(bucket)
        .upload(filePath, file, { upsert: false });
      if (upErr) throw upErr;

      // Insert DB row (schema-correct)
      const row = {
        enterprise_id: enterpriseId,                 // nullable
        uploaded_by: userId,                         // required
        title: file.name.replace(/\.pdf$/i, ""),     // nice default title
        document_type: "other",                      // or "business_plan"/"pitch_deck" if you know
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || "application/pdf",
        access_level: "private",                     // one of: public/enterprise/private/confidential
        description: null,
        tags: null,
        metadata: null,
        is_public: false,
      };

      const { data: inserted, error: insErr } = await supabase
        .from("document")
        .insert(row)
        .select()
        .single();
      if (insErr) throw insErr;

      setDocuments((prev) => [inserted, ...prev]);
    } catch (e) {
      console.error(e);
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [userId, enterpriseId, bucket, maxSizeMb]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { "application/pdf": [".pdf"] },
    maxSize: maxSizeMb * 1024 * 1024,
  });

  // --- Rename (edit title only; keep file_name as the physical filename) ---

  const handleEdit = (docId) => setEditingDocId(docId);

  const handleSaveTitle = async (docId, newTitle) => {
    setError(null);
    const title = (newTitle || "").trim();
    if (!title) { setError("Title cannot be empty."); return; }

    const { error: updErr } = await supabase
      .from("document")
      .update({ title })
      .eq("id", docId)
      .eq("uploaded_by", userId); // ensure only your doc is updated
    if (updErr) { setError(updErr.message); return; }

    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, title } : d))
    );
    setEditingDocId(null);
  };

  // --- Render --------------------------------------------------------------

  return (
    <section className="bg-white border rounded-lg shadow-sm p-6 mt-6">
      <div
        {...getRootProps()}
        className={`p-6 border-2 border-dashed rounded-md cursor-pointer text-center ${
          isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex items-center justify-center gap-2 text-gray-700">
          <Upload className="w-5 h-5" />
          <p>{isDragActive ? "Drop your PDF…" : "Drag & drop a PDF here, or click to browse."}</p>
        </div>
        {uploading && (
          <div className="mt-2 text-sm text-blue-700">
            Uploading… (this may take a moment)
          </div>
        )}
        {error && (
          <div className="mt-2 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>

      <h2 className="text-lg font-semibold mt-8 mb-4 text-gray-800">
        Uploaded Documents
      </h2>

      {documents.length === 0 ? (
        <p className="text-gray-500 text-sm italic">No documents uploaded yet.</p>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => (
            <DocRow
              key={doc.id}
              doc={doc}
              bucket={bucket}
              editingDocId={editingDocId}
              onEdit={handleEdit}
              onSaveTitle={handleSaveTitle}
              fetchSignedUrl={fetchSignedUrl}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DocRow({ doc, bucket, editingDocId, onEdit, onSaveTitle, fetchSignedUrl }) {
  const [viewUrl, setViewUrl] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const url = await fetchSignedUrl(doc.file_path);
      if (mounted) setViewUrl(url);
    })();
    return () => { mounted = false; };
  }, [doc.file_path, fetchSignedUrl]);

  return (
    <div className="border rounded-md p-4 flex justify-between items-start">
      <div className="flex-1">
        {editingDocId === doc.id ? (
          <input
            type="text"
            className="border rounded px-2 py-1 mb-1 w-full"
            defaultValue={doc.title || doc.file_name}
            onBlur={(e) => onSaveTitle(doc.id, e.target.value)}
            autoFocus
          />
        ) : (
          <p className="font-medium">{doc.title || doc.file_name}</p>
        )}

        <p className="text-sm text-gray-500">
          {doc.file_name} • {new Date(doc.uploaded_at || doc.created_at).toLocaleDateString()}
        </p>

        <div className="flex gap-3 mt-2">
          <button
            onClick={() => onEdit(doc.id)}
            className="text-sm text-blue-600 flex items-center"
          >
            <Pencil className="w-4 h-4 mr-1" />
            Rename
          </button>

          {viewUrl ? (
            <a
              href={viewUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-gray-600 flex items-center"
            >
              <Eye className="w-4 h-4 mr-1" />
              View
            </a>
          ) : (
            <span className="text-sm text-gray-400 flex items-center">
              <Eye className="w-4 h-4 mr-1" />
              Generating link…
            </span>
          )}
        </div>
      </div>

      <CheckCircle className="w-5 h-5 text-green-500 mt-1" />
    </div>
  );
}
