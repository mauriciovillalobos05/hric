import React, { useState } from "react";
import ProgressBar from "./ui/progressBar";
import Button from "./ui/button";
import { CheckCircle, XCircle } from "lucide-react";

function ProfileStatusCard({
  completion,
  missingSections = [],
  onUpdateClick,
}) {
  const isComplete = completion === 100;
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedSection, setSelectedSection] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [file, setFile] = useState(null);

  const handleUpload = () => {
    console.log("Uploading:", {
      section: selectedSection,
      title: docTitle,
      file,
    });
    setShowUploadModal(false);
    setSelectedSection("");
    setDocTitle("");
    setFile(null);
  };

  return (
    <section className="bg-white border rounded-lg shadow-sm p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="w-full">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            Profile Completion
          </h3>

          {isComplete ? (
            <div className="flex items-center gap-2 text-green-600 font-medium">
              <CheckCircle className="w-5 h-5" />
              Your profile is fully complete.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">
                  Profile Completion
                </p>
                <p className="text-sm text-blue-600 font-semibold">
                  {completion}%
                </p>
              </div>

              <ProgressBar value={completion} />

              {missingSections.length > 0 ? (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <p className="text-sm font-medium text-red-700">
                      Missing Information
                    </p>
                  </div>
                  <ul className="list-disc list-inside text-sm text-gray-700 ml-1">
                    {missingSections.map((section, i) => (
                      <li key={i}>{section}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="mt-4 flex items-center text-green-600 text-sm gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <p>Your profile is fully complete!</p>
                </div>
              )}
            </>
          )}
        </div>

        {!isComplete && (
          <div className="space-y-2">
            <Button onClick={() => setShowUploadModal(true)}>
              Upload Documents
            </Button>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[90%] max-w-md p-6 relative">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              Upload Document
            </h2>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Missing Section
            </label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-4 text-sm"
            >
              <option value="">-- Select --</option>
              {missingSections.map((section, i) => (
                <option key={i} value={section}>
                  {section}
                </option>
              ))}
            </select>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document Title
            </label>
            <input
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-4 text-sm"
              placeholder="e.g., Financial Report Q2"
            />
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Upload File
            </label>

            <div className="relative mb-4">
              <input
                type="file"
                id="upload"
                onChange={(e) => setFile(e.target.files[0])}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <label
                htmlFor="upload"
                className="flex items-center justify-center bg-gray-100 hover:bg-gray-200 border border-gray-300 text-sm text-gray-700 font-medium px-4 py-2 rounded-md cursor-pointer transition"
              >
                Choose File
              </label>
              {file && (
                <p className="text-xs text-gray-600 mt-1 truncate">
                  Selected: {file.name}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowUploadModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!selectedSection || !docTitle || !file}
              >
                Upload
              </Button>
            </div>

            <button
              className="absolute top-2 right-3 text-gray-400 hover:text-black text-xl"
              onClick={() => setShowUploadModal(false)}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default ProfileStatusCard;
