interface ReportViewProps {
  answer: string;
}

export function ReportView({ answer }: ReportViewProps) {
  return <pre className="report-view">{answer}</pre>;
}
