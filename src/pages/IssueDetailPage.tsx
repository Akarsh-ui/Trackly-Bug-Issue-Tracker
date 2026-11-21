import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { IssueDetailView } from '../components/IssueDetailView';

export function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) return null;

  return (
    <div className="space-y-4">
      <Link
        to="/issues"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Issues</span>
      </Link>

      <div className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] overflow-hidden bg-white dark:bg-[#201F1D]">
        <IssueDetailView issueId={id} />
      </div>
    </div>
  );
}
