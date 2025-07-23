import React from "react";
import ProgressBar from "./ui/progressBar";
import Button from "./ui/button";
import { CheckCircle } from "lucide-react";

function ProfileStatusCard({ completion, missingSections = [], onUpdateClick }) {
  const isComplete = completion === 100;

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
              <p className="text-sm text-gray-600 mb-2">
                Your profile is {completion}% complete
              </p>

              {/* Progress Bar only shows if not 100% */}
              <ProgressBar value={completion} />

              {/* Missing sections list */}
              {missingSections.length > 0 && (
                <ul className="text-sm text-gray-500 list-disc list-inside mt-2">
                  {missingSections.map((section, i) => (
                    <li key={i}>{section}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* Button only shows if not complete */}
        {!isComplete && (
          <div>
            <Button onClick={onUpdateClick}>Update Profile</Button>
          </div>
        )}
      </div>
    </section>
  );
}

export default ProfileStatusCard;
