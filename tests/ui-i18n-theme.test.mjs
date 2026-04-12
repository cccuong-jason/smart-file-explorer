import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

test('translation dictionaries include keys required by the main unfinished UI surfaces', () => {
  const vi = readJson('src/lib/i18n/dictionaries/vi.json');
  const en = readJson('src/lib/i18n/dictionaries/en.json');

  const requiredKeys = [
    'general',
    'privacy',
    'settings_subtitle',
    'shortcut_title',
    'shortcut_description',
    'shortcut_record',
    'shortcut_success',
    'privacy_local_title',
    'privacy_local_description',
    'privacy_index_title',
    'privacy_items',
    'privacy_export_title',
    'privacy_export_description',
    'privacy_export_cta',
    'privacy_exporting',
    'privacy_reset_title',
    'privacy_reset_description',
    'privacy_reset_warning',
    'privacy_reset_cta',
    'privacy_resetting',
    'confirm_clear_index',
    'search_input_placeholder',
    'search_submit_hint',
    'search_recent',
    'tutorial',
    'toggle_theme',
    'toggle_language',
    'language_vi',
    'language_en',
    'sort_ascending',
    'sort_descending',
    'preview_empty_title',
    'preview_empty_description',
    'copy_path',
    'open_natively',
    'file_information',
    'preview',
    'preview_not_available',
    'preview_truncated',
    'related_files',
    'path_copied',
    'open_file_failed',
    'tag_add_failed',
    'tag_remove_failed',
    'copy_path_modal_title',
    'copy_path_modal_description',
    'copy_path_modal_label',
    'copy_path_modal_examples',
    'copy_path_modal_acknowledge',
    'tour_scan_title',
    'tour_scan_description',
    'tour_search_title',
    'tour_search_description',
    'tour_settings_title',
    'tour_settings_description',
    'tour_hotkey_title',
    'tour_hotkey_description',
    'tour_back',
    'tour_next',
    'tour_get_started',
    'scan_discovering',
    'scan_starting',
    'scan_completed',
    'scan_failed',
    'index_cleared',
    'favorite_added',
    'favorite_removed',
    'favorite_failed',
  ];

  for (const key of requiredKeys) {
    assert.ok(vi[key], `Missing vi translation key: ${key}`);
    assert.ok(en[key], `Missing en translation key: ${key}`);
  }
});

test('main UI components no longer contain known hard-coded English copy from the unfinished integration', () => {
  const files = [
    'src/app/page.tsx',
    'src/components/file-viewer/file-preview-panel.tsx',
    'src/components/search/search-input.tsx',
    'src/components/settings/settings-modal.tsx',
    'src/components/ui/copy-path-modal.tsx',
    'src/components/onboarding/first-visit-tour.tsx',
  ];

  const forbiddenSnippets = [
    'Show Tutorial',
    'Ascending',
    'Descending',
    'Search files by name or content...',
    'Manage preferences and local data',
    'Global Search Shortcut',
    'Pressing this keyboard shortcut opens the Spotlight Search overlay from anywhere in your operating system.',
    '100% Local Processing',
    'Export Index Data',
    'Reset Local Index',
    'Clear Search Cache',
    'Select a file',
    'Click on a file item to view its details and content preview.',
    'Copy Path',
    'Open Natively',
    'How to use this path',
    'Recent Searches',
    'Index Your Folders',
    'Instant Local Search',
    'Private & Secure',
    'Spotlight Search Anywhere',
  ];

  const combined = files.map(read).join('\n');

  for (const snippet of forbiddenSnippets) {
    assert.equal(
      combined.includes(snippet),
      false,
      `Found unfinished hard-coded UI text: ${snippet}`
    );
  }
});

test('affected shared UI components include dark mode styling hooks', () => {
  const themedFiles = [
    'src/components/file-viewer/file-preview-panel.tsx',
    'src/components/search/search-input.tsx',
    'src/components/settings/settings-modal.tsx',
    'src/components/ui/copy-path-modal.tsx',
    'src/components/ui/toast.tsx',
    'src/components/onboarding/first-visit-tour.tsx',
  ];

  for (const file of themedFiles) {
    const content = read(file);
    assert.match(content, /dark:/, `${file} is missing dark mode styling hooks`);
  }
});

test('main page includes inline toolbar controls for theme and language instead of settings-owned selectors', () => {
  const page = read('src/app/page.tsx');
  const settings = read('src/components/settings/settings-modal.tsx');

  assert.match(page, /toggle_theme/, 'Main toolbar should expose a theme toggle control');
  assert.match(page, /toggle_language/, 'Main toolbar should expose a language toggle control');
  assert.equal(settings.includes("t('language')"), false, 'Settings modal should no longer render the language selector');
  assert.equal(settings.includes("t('theme')"), false, 'Settings modal should no longer render the theme selector');
});

test('global styles include custom scrollbar styling for dark mode surfaces', () => {
  const globals = read('src/app/globals.css');

  assert.match(globals, /::-webkit-scrollbar/, 'Globals should style webkit scrollbars');
  assert.match(globals, /scrollbar-color:/, 'Globals should style Firefox scrollbars');
  assert.match(globals, /dark/, 'Scrollbar styling should account for dark surfaces');
});
