export class MigrationService {
  /**
   * Run database migrations
   */
  async runMigrations() {
    const { umzug } = await import('../../../config/migrate');
    await umzug.up();
    return { success: true, message: 'Migrations applied' };
  }
}

export const migrationService = new MigrationService();
