import { systemSettingsService } from './system';
import { aiSettingsService } from './ai';

export class SettingsService {
  async getSettings() {
    return await systemSettingsService.getSettings();
  }

  async getSetting(key: string) {
    return await systemSettingsService.getSetting(key);
  }

  async updateSettings(updates: Record<string, any>, userId: number) {
    return await systemSettingsService.updateSettings(updates, userId);
  }

  async getAISettings() {
    return await aiSettingsService.getAISettings();
  }

  async updateAISettings(updates: any, userId: number) {
    return await aiSettingsService.updateAISettings(updates, userId);
  }

  async refreshGeminiModels(apiKey: string) {
    return await aiSettingsService.refreshGeminiModels(apiKey);
  }
}

export const settingsService = new SettingsService();
export * from './system';
export * from './ai';
