export interface BrowserFileRecord {
  path: string;
  name: string;
  size: number;
  lastModified: number;
  tags?: string[];
  isStarred?: boolean;
  score?: number;
}

export interface BrowserFilters {
  types: string[];
  date: string;
  size: string[];
  tags: string[];
  favorites: boolean;
}

export type SortBy = 'date' | 'size' | 'name' | 'relevance';
export type SortOrder = 'asc' | 'desc';

function getExtension(name: string) {
  return `.${name.split('.').pop()?.toLowerCase()}`;
}

export function filterFiles(files: BrowserFileRecord[], filters: BrowserFilters, now = new Date()) {
  return files.filter((file) => {
    const ext = getExtension(file.name);

    if (filters.types.length > 0) {
      const isDoc = ['.pdf', '.docx', '.txt', '.md'].includes(ext);
      const isCode = ['.js', '.ts', '.tsx', '.py', '.json', '.html', '.css', '.xml', '.yaml', '.yml'].includes(ext);
      const isImage = ['.jpg', '.png', '.gif', '.svg'].includes(ext);
      const matchesType = filters.types.some((type) => {
        if (type === 'doc') return isDoc;
        if (type === 'code') return isCode;
        if (type === 'image') return isImage;
        return true;
      });

      if (!matchesType) {
        return false;
      }
    }

    if (filters.date !== 'any') {
      const diffDays = Math.ceil(Math.abs(now.getTime() - new Date(file.lastModified).getTime()) / (1000 * 60 * 60 * 24));
      if (filters.date === 'today' && diffDays > 1) return false;
      if (filters.date === 'week' && diffDays > 7) return false;
      if (filters.date === 'month' && diffDays > 30) return false;
    }

    if (filters.size.length > 0) {
      const sizeKB = file.size / 1024;
      const matchesSize = filters.size.some((size) => {
        if (size === 'small') return sizeKB < 100;
        if (size === 'medium') return sizeKB >= 100 && sizeKB < 1000;
        if (size === 'large') return sizeKB >= 1000 && sizeKB < 100000;
        if (size === 'huge') return sizeKB >= 100000;
        return true;
      });

      if (!matchesSize) {
        return false;
      }
    }

    if (filters.tags.length > 0) {
      if (!file.tags?.length) {
        return false;
      }
      if (!filters.tags.some((tag) => file.tags?.includes(tag))) {
        return false;
      }
    }

    if (filters.favorites && !file.isStarred) {
      return false;
    }

    return true;
  });
}

export function sortFiles(files: BrowserFileRecord[], sortBy: SortBy, sortOrder: SortOrder) {
  const sorted = [...files].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'relevance':
        comparison = (a.score || 0) - (b.score || 0);
        break;
      case 'date':
        comparison = (a.lastModified || 0) - (b.lastModified || 0);
        break;
      case 'size':
        comparison = (a.size || 0) - (b.size || 0);
        break;
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

export function paginateFiles(files: BrowserFileRecord[], currentPage: number, itemsPerPage: number) {
  const start = (currentPage - 1) * itemsPerPage;
  return files.slice(start, start + itemsPerPage);
}

export function extractUniqueTags(files: BrowserFileRecord[]) {
  const tags = new Set<string>();
  files.forEach((file) => file.tags?.forEach((tag) => tags.add(tag)));
  return Array.from(tags).sort();
}
