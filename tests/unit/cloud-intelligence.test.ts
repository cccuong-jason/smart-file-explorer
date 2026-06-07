import { describe, expect, it } from 'vitest';

import {
  isCloudIntelligenceReady,
  type CloudIntelligenceStatus,
} from '@/lib/settings/cloud-intelligence';

const connectedStatus: CloudIntelligenceStatus = {
  configured: true,
  source: 'user',
  model: 'qwen/qwen3.6-plus',
};

describe('cloud intelligence settings', () => {
  it('is ready only when enabled, configured, and without a connection error', () => {
    expect(isCloudIntelligenceReady(true, connectedStatus)).toBe(true);
    expect(isCloudIntelligenceReady(false, connectedStatus)).toBe(false);
    expect(isCloudIntelligenceReady(true, { ...connectedStatus, configured: false })).toBe(false);
    expect(isCloudIntelligenceReady(true, { ...connectedStatus, lastError: 'User not found.' })).toBe(false);
  });
});
