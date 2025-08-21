import React, { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  CheckCircle,
  AlertCircle,
  Eye,
  Upload,
  Pencil,
  Save,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function DocumentStatus({ initialDocuments = [] }) {
  const [documents, setDocuments] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [editingDocId, setEditingDocId] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const fetchUserAndDocuments = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: docs, error } = await supabase
        .from("document")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (!error) setDocuments(docs);
    };

    fetchUserAndDocuments();
  }, []);

  const onDrop = useCallback(async (acceptedFiles) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const file = acceptedFiles[0];
    const filePath = `${user.id}/${Date.now()}-${file.name}`;

    const upload = await supabase.storage
      .from("user-documents")
      .upload(filePath, file, {
        upsert: false,
        onUploadProgress: (progressEvent) => {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percent);
        },
      });

    if (upload.error) {
      console.error("Upload failed:", upload.error.message);
      return;
    }

    // Save metadata
    const { data, error: insertErr } = await supabase
      .from("document")
      .insert({
        owner_id: user.id,
        filename: file.name,
        file_path: filePath,
        access_level: "private",
      })
      .select()
      .single();

    if (insertErr) {
      console.error("DB insert failed:", insertErr.message);
    } else {
      setDocuments((prev) => [data, ...prev]);
    }

    setUploadProgress(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleEdit = (docId) => setEditingDocId(docId);

  const handleSave = async (docId, field, value) => {
    const { error } = await supabase
      .from("document")
      .update({ [field]: value })
      .eq("id", docId);

    if (error) console.error("Failed to update doc:", error.message);
    else {
      setDocuments((prev) =>
        prev.map((doc) => (doc.id === docId ? { ...doc, [field]: value } : doc))
      );
      setEditingDocId(null);
    }
  };

  return (
    <section className="bg-white border rounded-lg shadow-sm p-6 mt-6">
      <div
        {...getRootProps()}
        className={`p-6 border-2 border-dashed rounded-md cursor-pointer text-center ${
          isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
        }`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p className="text-blue-700">Drop the files here ...</p>
        ) : (
          <p className="text-gray-600">
            Drag & drop your documents here, or click to browse.
          </p>
        )}
        {uploadProgress !== null && (
          <div className="mt-2 text-sm text-blue-700">
            Uploading... {uploadProgress}%
          </div>
        )}
      </div>

      <h2 className="text-lg font-semibold mt-8 mb-4 text-gray-800">
        Uploaded Documents
      </h2>
      {documents.length === 0 ? (
        <p className="text-gray-500 text-sm italic">
          No documents uploaded yet.
        </p>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="border rounded-md p-4 flex justify-between items-start"
            >
              <div className="flex-1">
                {editingDocId === doc.id ? (
                  <>
                    <input
                      type="text"
                      className="border rounded px-2 py-1 mb-1 w-full"
                      defaultValue={doc.filename}
                      onBlur={(e) =>
                        handleSave(doc.id, "filename", e.target.value)
                      }
                    />
                  </>
                ) : (
                  <p className="font-medium">{doc.filename}</p>
                )}
                <p className="text-sm text-gray-500">
                  Uploaded on {new Date(doc.created_at).toLocaleDateString()}
                </p>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => handleEdit(doc.id)}
                    className="text-sm text-blue-600 flex items-center"
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    Rename
                  </button>
                  <a
                    href={
                      supabase.storage
                        .from("user-documents")
                        .getPublicUrl(doc.file_path).data.publicUrl
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-gray-600 flex items-center"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </a>
                </div>
              </div>

              <CheckCircle className="w-5 h-5 text-green-500 mt-1" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
