import { Button } from "@/components/ui/button";

const sections = [
  { id: "matches", label: "Match" },
  { id: "events", label: "Events" },
  { id: "documents", label: "Documents" },
  { id: "insights", label: "Insights" },
];

export default function DashboardShortcuts() {
  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex gap-3 mb-4 flex-wrap">
      {sections.map((section) => (
        <Button
          key={section.id}
          variant="outline"
          onClick={() => scrollToSection(section.id)}
          className="text-sm"
        >
          {section.label}
        </Button>
      ))}
    </div>
  );
}
