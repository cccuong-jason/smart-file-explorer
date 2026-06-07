import { invoke } from '@tauri-apps/api/core';

export const CLOUD_INTELLIGENCE_ENABLED_KEY = 'sfe_cloud_intelligence_enabled';
export const DEFAULT_CLOUD_INTELLIGENCE_MODEL = 'qwen/qwen3.6-plus';

export interface CloudIntelligenceStatus {
  configured: boolean;
  source: 'user' | 'project' | 'none';
  model: string;
  lastTestedAt?: number;
  lastError?: string;
}

export interface SaveCloudIntelligenceConfigInput {
  apiKey: string;
  model: string;
}

export interface TestCloudIntelligenceConnectionInput {
  apiKey?: string;
  model?: string;
}

export function isCloudIntelligenceReady(
  enabled: boolean,
  status: Pick<CloudIntelligenceStatus, 'configured' | 'lastError'>,
) {
  return enabled && status.configured && !status.lastError;
}

export function getCloudIntelligenceEnabled() {
  if (typeof window === 'undefined') {
    return true;
  }

  const value = window.localStorage.getItem(CLOUD_INTELLIGENCE_ENABLED_KEY);
  return value === null ? true : value === 'true';
}

export function setCloudIntelligenceEnabled(enabled: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CLOUD_INTELLIGENCE_ENABLED_KEY, String(enabled));
}

export function getCloudIntelligenceStatus() {
  return invoke<CloudIntelligenceStatus>('get_cloud_intelligence_status');
}

export function saveCloudIntelligenceConfig(input: SaveCloudIntelligenceConfigInput) {
  return invoke<CloudIntelligenceStatus>('save_cloud_intelligence_config', { input });
}

export function testCloudIntelligenceConnection(input: TestCloudIntelligenceConnectionInput) {
  return invoke<CloudIntelligenceStatus>('test_cloud_intelligence_connection', { input });
}

export function clearCloudIntelligenceConfig() {
  return invoke<CloudIntelligenceStatus>('clear_cloud_intelligence_config');
}
