import path from 'path';
import fs from 'fs';
import { logger } from '../../../utils/system/logger';
import { pickerScript } from './templates/pickerScript';

export class DebugService {
  /**
   * Save debug HTML to file
   */
  saveDebugHtml(url: string, html: string): string | null {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace(/[^a-z0-9]/gi, '_');
      const filename = `debug_${Date.now()}_${domain}.html`;
      const debugDir = path.join(process.cwd(), 'debug_html');
      
      if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });

      let modifiedHtml = html;
      if (html.includes('</body>')) {
        modifiedHtml = html.replace('</body>', pickerScript + '\n</body>');
      }

      const filePath = path.join(debugDir, filename);
      fs.writeFileSync(filePath, modifiedHtml);
      
      // Cleanup old files (keep last 50)
      const files = fs.readdirSync(debugDir)
        .map((f: any) => ({ name: f, time: fs.statSync(path.join(debugDir, f)).mtime.getTime() }))
        .sort((a: any, b: any) => b.time - a.time);
      
      if (files.length > 50) {
        files.slice(50).forEach((f: any) => {
          try {
            fs.unlinkSync(path.join(debugDir, f.name));
          } catch (e) {}
        });
      }

      return `/debug_files/${filename}`;
    } catch (e) {
      logger.debug('System | Debug | Failed to save HTML', 'Debug', e);
      return null;
    }
  }
}

export const debugService = new DebugService();
