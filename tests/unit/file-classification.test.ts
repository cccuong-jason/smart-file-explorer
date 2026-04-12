import { describe, expect, it } from 'vitest';

import {
  classifyFile,
  matchesFileTypeSelection,
  type FileTypeFilterId,
} from '@/lib/file-browser/classification';

describe('file classification', () => {
  it('maps common work files into stable groups and subtypes', () => {
    expect(classifyFile('proposal.pdf')).toMatchObject({ group: 'documents', subtype: 'pdf' });
    expect(classifyFile('statement.docx')).toMatchObject({ group: 'documents', subtype: 'word' });
    expect(classifyFile('notes.md')).toMatchObject({ group: 'documents', subtype: 'text' });
    expect(classifyFile('sheet.xlsx')).toMatchObject({ group: 'documents', subtype: 'spreadsheet' });
    expect(classifyFile('slides.pptx')).toMatchObject({ group: 'documents', subtype: 'presentation' });
    expect(classifyFile('photo.png')).toMatchObject({ group: 'images', subtype: 'raster' });
    expect(classifyFile('archive.zip')).toMatchObject({ group: 'archives', subtype: 'archive' });
  });

  it('supports both top-level and nested filter matching', () => {
    const pdfSelections: FileTypeFilterId[] = ['documents:pdf'];
    const documentSelections: FileTypeFilterId[] = ['documents'];

    expect(matchesFileTypeSelection('proposal.pdf', pdfSelections)).toBe(true);
    expect(matchesFileTypeSelection('proposal.docx', pdfSelections)).toBe(false);
    expect(matchesFileTypeSelection('proposal.pdf', documentSelections)).toBe(true);
    expect(matchesFileTypeSelection('notes.md', documentSelections)).toBe(true);
    expect(matchesFileTypeSelection('clip.mp4', documentSelections)).toBe(false);
  });
});
