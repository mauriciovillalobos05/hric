import React, { useState } from "react";
import {
  CheckCircle,
  AlertCircle,
  Eye,
  Upload,
  PlusCircle,
  Pencil,
  Save,
} from "lucide-react";

function DocumentStatus({ initialDocuments = [] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [editIndex, setEditIndex] = useState(null);

  const handleUpload = (index, event) => {
    const file = event.target.files[0];
    if (!file) return;

    const updatedDocs = [...documents];
    updatedDocs[index] = {
      ...updatedDocs[index],
      uploaded: true,
      uploadDate: new Date().toLocaleDateString(),
      name: file.name,
      lastViewedBy: "InvestorBot",
      lastViewedDate: new Date().toLocaleDateString(),
    };
    setDocuments(updatedDocs);
  };

  const handleAddDocument = () => {
    setDocuments([
      ...documents,
      {
        name: "New Document",
        description: "",
        uploaded: false,
        uploadDate: null,
        lastViewedBy: null,
        lastViewedDate: null,
      },
    ]);
    setEditIndex(documents.length);
  };

  const handleEditField = (index, field, value) => {
    const updatedDocs = [...documents];
    updatedDocs[index][field] = value;
    setDocuments(updatedDocs);
  };

  const handleSave = () => setEditIndex(null);

  return (
    <section className="bg-white border rounded-lg shadow-sm p-6 mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Document Status</h2>
        <button
          onClick={handleAddDocument}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
        >
          <PlusCircle className="w-4 h-4" />
          Add Document
        </button>
      </div>

      {documents.length === 0 ? (
        <p className="text-gray-500 text-sm italic">No documents added yet.</p>
      ) : (
        <div className="space-y-4">
          {documents.map((doc, i) => (
            <div
              key={i}
              className="flex justify-between items-center border p-3 rounded-md hover:bg-gray-50 transition"
            >
              <div className="flex-1 pr-4">
                {editIndex === i ? (
                  <>
                    <input
                      type="text"
                      value={doc.name}
                      onChange={(e) => handleEditField(i, "name", e.target.value)}
                      className="w-full text-sm font-medium border rounded p-1 mb-1"
                      placeholder="Document title"
                    />
                    <textarea
                      value={doc.description || ""}
                      onChange={(e) => handleEditField(i, "description", e.target.value)}
                      className="w-full text-sm text-gray-600 border rounded p-1"
                      rows={2}
                      placeholder="Document description"
                    />
                  </>
                ) : (
                  <>
                    <p className="font-medium">{doc.name}</p>
                    <p className="text-sm text-gray-500">
                      {doc.uploaded
                        ? `Uploaded on ${doc.uploadDate}`
                        : "Not uploaded"}
                    </p>
                    {doc.description && (
                      <p className="text-sm text-gray-400 italic mt-1">
                        {doc.description}
                      </p>
                    )}
                    {doc.lastViewedBy && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Eye className="w-4 h-4 inline" />
                        Last viewed by {doc.lastViewedBy} on{" "}
                        {doc.lastViewedDate}
                      </p>
                    )}
                  </>
                )}

                <div className="mt-2 flex gap-3 items-center">
                  {/* Upload input */}
                  <label className="inline-flex items-center cursor-pointer text-blue-600 text-sm font-medium">
                    <Upload className="w-4 h-4 mr-1" />
                    Upload
                    <input
                      type="file"
                      onChange={(e) => handleUpload(i, e)}
                      className="hidden"
                    />
                  </label>

                  {/* Edit/Save button */}
                  {editIndex === i ? (
                    <button
                      onClick={handleSave}
                      className="flex items-center text-green-600 text-sm"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      Save
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditIndex(i)}
                      className="flex items-center text-gray-600 text-sm"
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {/* Status Icon */}
              <div>
                {doc.uploaded ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default DocumentStatus;
