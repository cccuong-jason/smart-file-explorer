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
    'diagnostics',
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
    'diagnostics_title',
    'diagnostics_description',
    'diagnostics_refresh',
    'diagnostics_copy_summary',
    'diagnostics_export_bundle',
    'diagnostics_exporting',
    'diagnostics_exported',
    'diagnostics_export_unavailable',
    'diagnostics_summary_copied',
    'diagnostics_clear_events',
    'diagnostics_cleared',
    'diagnostics_events',
    'diagnostics_watch_roots',
    'diagnostics_native_logs',
    'diagnostics_log_path',
    'diagnostics_not_available',
    'diagnostics_recent_events',
    'diagnostics_filter_level',
    'diagnostics_filter_area',
    'diagnostics_empty',
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
    'toggle_language',
    'language_vi',
    'language_en',
    'tree_view',
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
    'src/components/retroui/Sonner.tsx',
    'src/components/onboarding/first-visit-tour.tsx',
  ];

  for (const file of themedFiles) {
    const content = read(file);
    assert.match(
      content,
      /dark:|bg-card|bg-secondary|text-muted-foreground|border-border/,
      `${file} is missing dark mode styling hooks or shared theme tokens`
    );
  }
});

test('main page keeps language inline and removes dark mode controls', () => {
  const page = read('src/app/page.tsx');
  const settings = read('src/components/settings/settings-modal.tsx');

  assert.doesNotMatch(page, /toggle_theme|handleToggleTheme|setTheme\(/, 'Main toolbar should not expose dark mode controls');
  assert.match(page, /toggle_language/, 'Main toolbar should expose a language toggle control');
  assert.match(page, /tree_view/, 'Main toolbar should expose a tree view toggle control');
  assert.equal(settings.includes("t('language')"), false, 'Settings modal should no longer render the language selector');
  assert.equal(settings.includes("t('theme')"), false, 'Settings modal should no longer render the theme selector');
});

test('main tree view opens as a full folder and file hierarchy', () => {
  const page = read('src/app/page.tsx');

  assert.match(
    page,
    /<TreeView[\s\S]*nodes=\{treeViewNodes\}[\s\S]*expandAll/,
    'Main tree view should expand the full folder and file hierarchy'
  );
});

test('tray activity window can receive native watch events while the main window is hidden', () => {
  const page = read('src/app/tray-activity/page.tsx');
  const main = read('src/app/page.tsx');
  const capability = readJson('src-tauri/capabilities/default.json');

  assert.match(
    page,
    /listen<\{ kind: string; path: string \}>\('sys-file-event'/,
    'Tray activity should listen directly for native file watcher events'
  );
  assert.ok(
    capability.windows.includes('tray-activity'),
    'Tray activity must be included in the Tauri capability windows so event.listen is allowed'
  );
  assert.doesNotMatch(
    page,
    /getIndexingCoordinator|getFile|getWatchedFolders|resolveWatchedFileMetadata|deleteFile/,
    'Tray activity should stay lightweight and must not import the indexing/database stack'
  );
  assert.match(
    main,
    /createTrayActivityDetected[\s\S]*indexingCoordinator\.enqueue/,
    'Main watcher should show a tray detected state before background indexing can complete'
  );
});

test('async Tauri event listeners guard cleanup during development remounts', () => {
  const main = read('src/app/page.tsx');
  const tray = read('src/app/tray-activity/page.tsx');

  assert.match(
    main,
    /createAsyncUnlistenGuard/,
    'Main window watch listeners should guard async listen cleanup to avoid duplicate dev listeners'
  );
  assert.match(
    tray,
    /createAsyncUnlistenGuard/,
    'Tray activity listeners should guard async listen cleanup to avoid duplicate dev listeners'
  );
});

test('tray activity window is an opaque bottom-right work-area notification', () => {
  const tray = read('src/app/tray-activity/page.tsx');
  const layout = read('src/app/tray-activity/layout.tsx');
  const config = readJson('src-tauri/tauri.conf.json');
  const trayWindow = config.app.windows.find((window) => window.label === 'tray-activity');

  assert.equal(trayWindow.transparent, false, 'Tray activity should not use a transparent glass window');
  assert.match(tray, /primaryMonitor/, 'Tray activity should prefer the primary monitor for desktop-bar placement');
  assert.match(tray, /getTrayActivityWindowPosition/, 'Tray activity should use the shared work-area placement helper');
  assert.doesNotMatch(tray, /onFocusChanged/, 'Tray activity should not auto-hide or open the app just because the window gains focus');
  assert.doesNotMatch(tray, /min-h-screen[\s\S]*bg-transparent[\s\S]*p-4/, 'Tray shell should not leave a transparent padded glass area');
  assert.doesNotMatch(layout, /background:\s*transparent/, 'Tray layout should paint an opaque background behind the notification');
});

test('diagnostics feature exposes structured logging and native bundle commands', () => {
  const logger = read('src/lib/telemetry/logger.ts');
  const diagnostics = read('src/lib/telemetry/diagnostics.ts');
  const settings = read('src/components/settings/settings-modal.tsx');
  const native = read('src-tauri/src/lib.rs');
  const main = read('src/app/page.tsx');

  assert.match(logger, /export async function logEvent/, 'Frontend should expose structured logEvent');
  assert.match(diagnostics, /getDiagnosticSnapshot/, 'Frontend should expose diagnostic snapshots');
  assert.match(settings, /activeTab === 'diagnostics'/, 'Settings should render diagnostics tab content');
  assert.match(native, /fn log_frontend_event/, 'Native app should accept structured frontend events');
  assert.match(native, /fn export_diagnostic_bundle/, 'Native app should export diagnostic bundles');
  assert.match(native, /native_log_files/, 'Native diagnostic bundles should include recent native log file tails');
  assert.match(main, /area: 'watch'[\s\S]*event: 'native-event\.received'/, 'Watch flow should log native event receipt');
});

test('global styles include custom scrollbar styling for light RetroUI surfaces', () => {
  const globals = read('src/app/globals.css');

  assert.match(globals, /::-webkit-scrollbar/, 'Globals should style webkit scrollbars');
  assert.match(globals, /scrollbar-color:/, 'Globals should style Firefox scrollbars');
});

test('theme provider is locked to light mode for RetroUI', () => {
  const provider = read('src/lib/theme-provider.tsx');

  assert.match(provider, /const LIGHT_THEME/, 'Theme provider should define a light-only theme');
  assert.doesNotMatch(provider, /classList\.add\('dark'\)/, 'Theme provider should not apply the dark class');
});

test('RetroUI primitive migration replaces native controls, custom toast, and Lucide icons', () => {
  const packageJson = readJson('package.json');
  const componentsConfig = readJson('components.json');
  const sourceFiles = [
    'src/app/layout.tsx',
    'src/app/page.tsx',
    'src/app/spotlight/page.tsx',
    'src/components/search/search-input.tsx',
    'src/components/settings/settings-modal.tsx',
    'src/components/ui/tag-input.tsx',
    'src/components/ui/progress-bar.tsx',
    'src/components/file-viewer/file-grid-item.tsx',
    'src/components/file-viewer/file-list-item.tsx',
    'src/components/file-viewer/file-preview-panel.tsx',
    'src/components/file-viewer/quick-look-modal.tsx',
    'src/components/file-viewer/tree-view.tsx',
    'src/components/folder-intelligence/folder-intelligence-panel.tsx',
    'src/components/folder-intelligence/work-inbox-panel.tsx',
    'src/components/folder-intelligence/workspace-drill-in-modal.tsx',
    'src/components/onboarding/first-visit-tour.tsx',
    'src/components/onboarding/starter-scan-modal.tsx',
    'src/components/sidebar/filter-section.tsx',
    'src/components/tray-activity/tray-activity-pill.tsx',
    'src/components/ui/copy-path-modal.tsx',
    'src/components/ui/helper-alert.tsx',
    'src/components/ui/pagination.tsx',
    'src/components/icons.ts',
  ];
  const combined = sourceFiles.map(read).join('\n');

  const requiredPrimitives = [
    'Card',
    'Input',
    'Label',
    'Select',
    'Sonner',
    'Empty',
    'Loader',
    'Progress',
    'Switch',
    'Tabs',
    'Chart',
    'Carousel',
  ];

  for (const component of requiredPrimitives) {
    assert.ok(
      fs.existsSync(path.join(root, `src/components/retroui/${component}.tsx`)),
      `Missing RetroUI ${component} component`
    );
  }

  assert.equal(componentsConfig.iconLibrary, 'phosphor', 'components.json should declare Phosphor icons');
  assert.ok(packageJson.dependencies['@phosphor-icons/react'], 'Phosphor icon package should be installed');
  assert.equal(packageJson.dependencies['lucide-react'], undefined, 'Lucide dependency should be removed');
  assert.doesNotMatch(combined, /lucide-react/, 'Source should not import lucide-react');
  assert.match(combined, /@phosphor-icons\/react/, 'Source should import Phosphor icons');

  assert.doesNotMatch(combined, /@\/components\/ui\/toast/, 'Custom toast provider should no longer be used');
  assert.doesNotMatch(combined, /ToastProvider|useToast/, 'Custom toast context should no longer be wired');
  assert.match(read('src/app/layout.tsx'), /Toaster/, 'Layout should mount RetroUI Sonner Toaster');
  assert.match(combined, /from ['"]sonner['"]/, 'App code should use Sonner toast API');

  for (const file of [
    'src/app/page.tsx',
    'src/app/spotlight/page.tsx',
    'src/components/search/search-input.tsx',
    'src/components/settings/settings-modal.tsx',
    'src/components/ui/tag-input.tsx',
  ]) {
    const content = read(file);
    assert.doesNotMatch(content, /<input\b|<select\b/, `${file} should use RetroUI Input/Select instead of native controls`);
  }

  assert.match(read('src/app/page.tsx'), /Tabs/, 'Main app should split work intelligence and files directory with RetroUI Tabs');
  assert.match(
    read('src/app/page.tsx'),
    /<Tabs defaultValue="work"/,
    'Main app should open on the work inbox dashboard tab'
  );
  assert.match(
    read('src/app/page.tsx'),
    /<Tabs\.Content value="files"[\s\S]*<Select value=\{sortBy\}/,
    'File view and sort controls should live inside the files directory tab'
  );
  assert.match(read('src/components/folder-intelligence/work-inbox-panel.tsx'), /Chart/, 'Work inbox should render a RetroUI chart summary');
  assert.match(
    read('src/components/folder-intelligence/work-inbox-panel.tsx'),
    /md:grid-cols-3/,
    'Work inbox dashboard insights should be split into smaller three-column cards'
  );
  assert.match(
    read('src/components/folder-intelligence/work-inbox-panel.tsx'),
    /Carousel/,
    'Work inbox should use RetroUI Carousel instead of custom arrow paging'
  );
  assert.doesNotMatch(
    read('src/components/folder-intelligence/work-inbox-panel.tsx'),
    /setStartIndex|startIndex|visibleItems|work_inbox_range/,
    'Work inbox should not keep custom arrow pagination state'
  );
  assert.match(
    read('src/components/folder-intelligence/work-inbox-panel.tsx'),
    /work_inbox_chart_open_continue[\s\S]*work_inbox_chart_review[\s\S]*work_inbox_chart_resolve[\s\S]*work_inbox_chart_extract/,
    'Work inbox chart should summarize action-oriented attention mix insights'
  );
  assert.match(read('src/components/ui/progress-bar.tsx'), /Progress/, 'File scan progress should use RetroUI Progress');
  assert.match(read('src/app/layout.tsx'), /IconContext\.Provider[\s\S]*weight:\s*['"]bold['"]/, 'Phosphor icons should default to bold weight');
});

test('GitHub Actions cover change quality, desktop packaging, and security scanning', () => {
  const workflow = read('.github/workflows/test-pipeline.yml');

  assert.match(workflow, /pull_request:/, 'Pipeline should run for pull requests');
  assert.match(workflow, /push:/, 'Pipeline should run for pushes');
  assert.match(workflow, /npm run typecheck/, 'Pipeline should type-check every change');
  assert.match(workflow, /npm run lint/, 'Pipeline should lint every change');
  assert.match(workflow, /npm run test:coverage/, 'Pipeline should run coverage tests');
  assert.match(workflow, /npm run test:regression/, 'Pipeline should run regression tests');
  assert.match(workflow, /npm run test:ui/, 'Pipeline should run UI smoke tests');
  assert.match(workflow, /npm run test:desktop/, 'Pipeline should run desktop Rust smoke tests');

  assert.match(workflow, /desktop-package:/, 'Pipeline should include a desktop package job');
  assert.match(workflow, /windows-latest/, 'Desktop package matrix should include Windows');
  assert.match(workflow, /macos-latest/, 'Desktop package matrix should include macOS');
  assert.match(workflow, /npm run desktop:bundle/, 'Desktop package job should build Tauri bundles');
  assert.match(workflow, /actions\/upload-artifact@v4/, 'Pipeline should upload generated artifacts');

  assert.match(workflow, /security:/, 'Pipeline should include a security job');
  assert.match(workflow, /npm audit/, 'Security job should scan Node dependencies');
  assert.match(workflow, /cargo audit/, 'Security job should scan Rust dependencies');
  assert.match(workflow, /github\/codeql-action\/init@v/, 'Security job should run CodeQL initialization');
  assert.match(workflow, /github\/codeql-action\/analyze@v/, 'Security job should run CodeQL analysis');
});

test('desktop bundle script can export CI artifacts to a stable directory', () => {
  const script = read('scripts/desktop-bundle.mjs');

  assert.match(
    script,
    /SMART_FILE_EXPLORER_BUNDLE_ARTIFACT_DIR/,
    'desktop bundle script should support a stable CI artifact output directory',
  );
  assert.match(script, /copyBundleArtifacts/, 'desktop bundle script should copy bundles for upload');
  assert.match(script, /release['"], ['"]bundle/, 'desktop bundle script should copy from the Tauri bundle directory');
});
