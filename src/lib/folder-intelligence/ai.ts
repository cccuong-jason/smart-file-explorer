import { invoke } from '@tauri-apps/api/core';
import type { FolderInsight } from './workspaces';

export interface FolderInsightAiSummary {
  workspaceId: string;
  title?: string;
  summary: string;
  highlights: string[];
  rationale: string[];
  model: string;
}

interface FolderInsightAiRequest {
  workspaceId: string;
  title: string;
  path: string;
  fileCount: number;
  ocrCount: number;
  recentCount: number;
  primaryTypeLabel: string;
  projectKeywords: string[];
  summary: string;
  highlights: string[];
  topFiles: Array<{
    path: string;
    name: string;
    group?: string;
    subtype?: string;
    lastModified: number;
    isStarred: boolean;
    isLikelyLatest: boolean;
    indexingStage?: string;
    tags: string[];
    snippet?: string;
  }>;
}

function buildFileSnippet(file: {
  content?: string;
}) {
  return file.content?.replace(/\s+/g, ' ').trim().slice(0, 280) || undefined;
}

export function buildFolderInsightSummaryFingerprint(insight: FolderInsight) {
  return JSON.stringify({
    path: insight.path,
    title: insight.title,
    fileCount: insight.fileCount,
    ocrCount: insight.ocrCount,
    recentCount: insight.recentCount,
    projectKeywords: insight.projectKeywords,
    topFiles: insight.importantFiles.slice(0, 4).map((file) => ({
      path: file.path,
      lastModified: file.lastModified,
      isStarred: Boolean(file.isStarred),
      isLikelyLatest: Boolean(file.isLikelyLatest),
      indexingStage: file.indexingStage ?? '',
    })),
  });
}

function buildFolderInsightAiRequest(insight: FolderInsight): FolderInsightAiRequest {
  return {
    workspaceId: insight.id,
    title: insight.title,
    path: insight.path,
    fileCount: insight.fileCount,
    ocrCount: insight.ocrCount,
    recentCount: insight.recentCount,
    primaryTypeLabel: insight.primaryTypeLabel,
    projectKeywords: insight.projectKeywords,
    summary: insight.summary,
    highlights: insight.highlights,
    topFiles: insight.importantFiles.slice(0, 4).map((file) => ({
      path: file.path,
      name: file.name,
      group: file.group,
      subtype: file.subtype,
      lastModified: file.lastModified,
      isStarred: Boolean(file.isStarred),
      isLikelyLatest: Boolean(file.isLikelyLatest),
      indexingStage: file.indexingStage,
      tags: file.tags ?? [],
      snippet: buildFileSnippet(file),
    })),
  };
}

export async function requestFolderInsightAiSummary(insight: FolderInsight) {
  return invoke<FolderInsightAiSummary>('generate_folder_intelligence_summary', {
    request: buildFolderInsightAiRequest(insight),
  });
}

export function applyFolderInsightAiSummary(
  insight: FolderInsight,
  aiSummary?: FolderInsightAiSummary | null,
): FolderInsight {
  if (!aiSummary) {
    return insight;
  }

  return {
    ...insight,
    title: aiSummary.title?.trim() || insight.title,
    summary: aiSummary.summary?.trim() || insight.summary,
    highlights: aiSummary.highlights?.length ? aiSummary.highlights : insight.highlights,
    rationale: aiSummary.rationale?.length ? aiSummary.rationale : insight.rationale,
    summarySource: 'ai',
    summaryModel: aiSummary.model,
  };
}
