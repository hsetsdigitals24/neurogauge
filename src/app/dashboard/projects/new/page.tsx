"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProjectTypeChooser from "./ProjectTypeChooser";
import NBackForm from "./NBackForm";
import AiQuestionnaireForm from "./AiQuestionnaireForm";

export default function NewProjectPage() {
  return (
    <Suspense fallback={null}>
      <NewProjectRouter />
    </Suspense>
  );
}

// Project creation branches on ?type=. With no type, show the chooser presenting
// the three creation flows.
function NewProjectRouter() {
  const params = useSearchParams();
  const type = params.get("type");

  if (type === "nback") return <NBackForm />;
  if (type === "ai-questionnaire") return <AiQuestionnaireForm />;
  return <ProjectTypeChooser />;
}
