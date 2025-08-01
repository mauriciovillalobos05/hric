import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import QuestionField from "@/components/questionField";

export default function RegisterModal({ open, onClose, event, role, onSubmit }) {
  const [answers, setAnswers] = useState({});

  const handleChange = (e) => {
    setAnswers({ ...answers, [e.target.name]: e.target.value });
  };

  const formattedEventDate = event?.date
    ? new Date(event.date).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "this event";

  const investorQuestions = [
    { name: "interest_topics", label: "What topics are you most interested in?", type: "text" },
    { name: "intro_preference", label: "Would you like post-event introductions?", type: "text" },
  ];

  const entrepreneurQuestions = [
    { name: "full_name", label: "Full Name *", type: "text", required: true },
    { name: "email", label: "Email *", type: "email", required: true },
    { name: "phone", label: "Phone Number *", type: "text", required: true },
    { name: "city_country", label: "City and Country *", type: "text", required: true },
    { name: "is_founder", label: "Are you the founder of the startup? *", type: "select", options: ["Yes", "No"], required: true },
    { name: "company_name", label: "Company Name *", type: "text", required: true },
    { name: "one_liner", label: "Describe your startup in one sentence *", type: "text", required: true },
    { name: "industry", label: "Industry *", type: "select", options: ["Fintech", "Health/Biotech", "Education", "Artificial Intelligence", "Social Impact", "Real Estate", "E-commerce", "Other"], required: true },
    { name: "problem_solution", label: "What problem are you solving and how? *", type: "textarea", required: true },
    { name: "goal", label: "What are you currently looking for? *", type: "select", options: ["Raising Capital", "Mentorship or Feedback", "Networking with Investors", "All of the above"], required: true },
    { name: "capital_needed", label: "How much capital do you estimate you need? *", type: "select", options: ["$10,000 – $25,000", "$25,000 – $50,000", "$50,000 – $100,000", "More than $100,000"], required: true },
    { name: "why_selected", label: "Why should you be selected to present at this event? *", type: "textarea", required: true },
    { name: "pitch_deck_link", label: "Link to your pitch deck (Drive, Notion, or PDF) *", type: "text", required: true },
    { name: "attendance", label: `Can you attend in person on ${formattedEventDate} (Hyatt Andares, Guadalajara)? *`, type: "select", options: ["Yes", "No"], required: true },
    { name: "confidentiality", label: "Do you accept that your information will be reviewed under confidentiality? *", type: "checkbox", required: true },
  ];

  const questions = role === "investor" ? investorQuestions : entrepreneurQuestions;

  const handleSubmit = (e) => {
    e.preventDefault();
    const requiredFields = questions.filter((q) => q.required).map((q) => q.name);
    const missing = requiredFields.filter((key) => {
      const val = answers[key];
      return !val || (typeof val === "string" && val.trim() === "");
    });

    if (missing.length > 0) {
      alert("Please fill out all required fields before submitting.");
      return;
    }

    onSubmit(answers);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{role === "investor" ? "Register for Event" : "Apply to Pitch"}</DialogTitle>
        </DialogHeader>

        <form className="space-y-4 max-h-[70vh] overflow-y-auto" onSubmit={handleSubmit}>
          {questions.map((q, idx) => (
            <QuestionField key={idx} question={q} value={answers[q.name]} onChange={handleChange} />
          ))}

          <Button type="submit" className="mt-3 w-full">
            Submit
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}