const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'TSGARMY.FC69',
    database: 'tsgdb'
  });

  try {
    // Get current columns for streak_card_rewards
    let [cols] = await conn.query("SHOW COLUMNS FROM streak_card_rewards LIKE 'isActive'");
    if (cols.length === 0) {
      await conn.query("ALTER TABLE streak_card_rewards ADD COLUMN isActive TINYINT(1) NOT NULL DEFAULT 1");
      console.log('Added isActive to streak_card_rewards');
    }

    cols = await conn.query("SHOW COLUMNS FROM streak_card_rewards LIKE 'updatedAt'");
    if (cols.length === 0) {
      await conn.query("ALTER TABLE streak_card_rewards ADD COLUMN updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL");
      console.log('Added updatedAt to streak_card_rewards');
    }

    // Get current columns for xp_card_milestones
    cols = await conn.query("SHOW COLUMNS FROM xp_card_milestones LIKE 'isActive'");
    if (cols.length === 0) {
      await conn.query("ALTER TABLE xp_card_milestones ADD COLUMN isActive TINYINT(1) NOT NULL DEFAULT 1");
      console.log('Added isActive to xp_card_milestones');
    }

    cols = await conn.query("SHOW COLUMNS FROM xp_card_milestones LIKE 'updatedAt'");
    if (cols.length === 0) {
      await conn.query("ALTER TABLE xp_card_milestones ADD COLUMN updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL");
      console.log('Added updatedAt to xp_card_milestones');
    }

    // Add new columns to achievements
    cols = await conn.query("SHOW COLUMNS FROM achievements LIKE 'badge'");
    if (cols.length === 0) {
      await conn.query("ALTER TABLE achievements ADD COLUMN badge VARCHAR(128) NULL");
      console.log('Added badge to achievements');
    }

    cols = await conn.query("SHOW COLUMNS FROM achievements LIKE 'tag'");
    if (cols.length === 0) {
      await conn.query("ALTER TABLE achievements ADD COLUMN tag VARCHAR(64) NULL");
      console.log('Added tag to achievements');
    }

    cols = await conn.query("SHOW COLUMNS FROM achievements LIKE 'requirementType'");
    if (cols.length === 0) {
      await conn.query("ALTER TABLE achievements ADD COLUMN requirementType ENUM('xp_milestone','login_streak','quiz_completion','task_completion','manual') DEFAULT 'manual'");
      console.log('Added requirementType to achievements');
    }

    cols = await conn.query("SHOW COLUMNS FROM achievements LIKE 'requirementValue'");
    if (cols.length === 0) {
      await conn.query("ALTER TABLE achievements ADD COLUMN requirementValue INT NULL");
      console.log('Added requirementValue to achievements');
    }

    cols = await conn.query("SHOW COLUMNS FROM achievements LIKE 'xpReward'");
    if (cols.length === 0) {
      await conn.query("ALTER TABLE achievements ADD COLUMN xpReward INT NOT NULL DEFAULT 0");
      console.log('Added xpReward to achievements');
    }

    // Create user_achievements table
    const [tables] = await conn.query("SHOW TABLES LIKE 'user_achievements'");
    if (tables.length === 0) {
      await conn.query(`
        CREATE TABLE user_achievements (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          userId BIGINT UNSIGNED NOT NULL,
          achievementId BIGINT UNSIGNED NOT NULL,
          earnedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          progress INT DEFAULT 0 NOT NULL,
          metadata TEXT NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          INDEX ua_user_idx (userId),
          INDEX ua_achievement_idx (achievementId),
          UNIQUE KEY ua_user_achievement_unique (userId, achievementId)
        ) ENGINE=InnoDB
      `);
      console.log('Created user_achievements table');
    }

    console.log('Migration complete');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await conn.end();
  }
})();
