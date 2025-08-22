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
  <div className="relative w-full min-h-[520px] flex items-center justify-center overflow-hidden rounded-2xl border bg-white">
    {/* soft gradient glow */}
    <div className="pointer-events-none absolute -inset-24 opacity-60 blur-2xl animate-pulse
                    bg-[radial-gradient(60rem_30rem_at_50%_-10%,theme(colors.blue.200),transparent),
                        radial-gradient(40rem_20rem_at_-10%_120%,theme(colors.purple.200),transparent),
                        radial-gradient(40rem_20rem_at_110%_120%,theme(colors.teal.200),transparent)]" />
    {/* card-ish chip */}
    <div className="relative rounded-2xl border bg-white/80 backdrop-blur px-10 py-7 shadow-xl">
      <span className="select-none text-3xl font-semibold tracking-tight text-gray-800">
        Coming soon
      </span>
    </div>
  </div>
);
}
