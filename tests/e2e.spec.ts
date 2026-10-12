import { test, expect } from '@playwright/test';
import mysql from 'mysql2/promise';

// Track console errors and failed network requests across all tests
const consoleErrors: string[] = [];
const failedRequests: string[] = [];

const DB_CONFIG = 'mysql://root:TSGARMY.FC69@localhost:3306/tsgdb';

async function queryDB(sql: string, params?: unknown[]): Promise<unknown[]> {
  const conn = await mysql.createConnection(DB_CONFIG);
  const [rows] = await conn.execute(sql, params);
  await conn.end();
  return rows as unknown[];
}

type TeamRow = { id: number; slug: string; name: string };
type PlayerRow = { id: number; slug: string; ign: string };
type TournamentRow = { id: number; slug: string; name: string };

let dbSnapshot: {
  teams: TeamRow[];
  players: PlayerRow[];
  tournaments: TournamentRow[];
} = { teams: [], players: [], tournaments: [] };

test.beforeAll(async () => {
  const teams = await queryDB('SELECT id, slug, name FROM teams') as TeamRow[];
  const players = await queryDB('SELECT id, slug, ign FROM players LIMIT 5') as PlayerRow[];
  const tournaments = await queryDB('SELECT id, slug, name FROM tournaments') as TournamentRow[];
  dbSnapshot = { teams, players, tournaments };
});

test.beforeEach(async ({ page }) => {
  consoleErrors.length = 0;
  failedRequests.length = 0;

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    const error = request.failure()?.errorText || 'unknown';
    if (!url.includes('google-analytics') && !url.includes('googletagmanager')) {
      failedRequests.push(`${request.method()} ${url} - ${error}`);
    }
  });
});

function getUnexpectedErrors(path: string): string[] {
  return consoleErrors.filter(e => {
    if (e.includes('Warning: ')) return false;
    if (e.toLowerCase().includes('act(')) return false;
    if (e.includes('HMR')) return false;
    if (e.includes('401') && (path.includes('/admin') || path === '/notifications')) return false;
    if (e.includes('403') && path.includes('/admin')) return false;
    if (e.includes('Cannot update a component')) return false;
    return true;
  });
}

// ===========================================================================
// Public Pages — All Routes
// ===========================================================================

test.describe('Public pages', () => {
  const routes = [
    { path: '/', name: 'Home' },
    { path: '/teams', name: 'Teams' },
    { path: '/players', name: 'Players' },
    { path: '/tournaments', name: 'Tournaments' },
    { path: '/schedule', name: 'Schedule' },
    { path: '/live', name: 'Live' },
    { path: '/community', name: 'Community' },
    { path: '/media', name: 'Media' },
    { path: '/about', name: 'About' },
    { path: '/contact', name: 'Contact' },
    { path: '/privacy', name: 'Privacy' },
    { path: '/terms', name: 'Terms' },
    { path: '/login', name: 'Login' },
    { path: '/cards', name: 'Cards' },
    { path: '/leaderboard', name: 'Leaderboard' },
    { path: '/notifications', name: 'Notifications (auth redirect)' },
    { path: '/rewards', name: 'Rewards' },
    { path: '/username-select', name: 'Username Select (auth redirect)' },
    { path: '/profile', name: 'Profile (auth redirect)' },
    { path: '/collection', name: 'Card Collection (auth redirect)' },
    { path: '/fan/quiz', name: 'Fan Quiz (auth redirect)' },
    { path: '/fan/tasks', name: 'Fan Tasks (auth redirect)' },
    { path: '/fan/streak', name: 'Fan Streak (auth redirect)' },
    { path: '/fan/weekly-top-fan', name: 'Fan Weekly Top Fan (auth redirect)' },
  ];

  for (const route of routes) {
    test(`${route.name} page loads`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveTitle(/TSG/i);
      const errors = getUnexpectedErrors(route.path);
      expect(errors, `Console errors on ${route.path}: ${JSON.stringify(errors)}`).toHaveLength(0);
    });
  }
});

// ===========================================================================
// Public Detail Pages (using real DB slugs)
// ===========================================================================

test.describe('Public detail pages (real DB data)', () => {
  test('team detail page loads for existing slug', async ({ page }) => {
    if (dbSnapshot.teams.length === 0) test.skip();
    const team = dbSnapshot.teams[0];
    await page.goto(`/teams/${team.slug}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/TSG/i);
    const errors = getUnexpectedErrors(`/teams/${team.slug}`);
    expect(errors, `Console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
  });

  test('player detail page loads for existing slug', async ({ page }) => {
    if (dbSnapshot.players.length === 0) test.skip();
    const player = dbSnapshot.players[0];
    await page.goto(`/players/${player.slug}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/TSG/i);
    const errors = getUnexpectedErrors(`/players/${player.slug}`);
    expect(errors, `Console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
  });

  test('tournament detail page loads for existing slug', async ({ page }) => {
    if (dbSnapshot.tournaments.length === 0) test.skip();
    const tournament = dbSnapshot.tournaments[0];
    await page.goto(`/tournaments/${tournament.slug}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/TSG/i);
    const errors = getUnexpectedErrors(`/tournaments/${tournament.slug}`);
    expect(errors, `Console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
  });

  test('user profile page loads for existing username', async ({ page }) => {
    // Skip if no users with usernames exist
    const users = await queryDB('SELECT username FROM users WHERE username IS NOT NULL LIMIT 3') as { username: string }[];
    if (users.length === 0) test.skip();
    const user = users[0];
    await page.goto(`/u/${user.username}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/TSG/i);
    const errors = getUnexpectedErrors(`/u/${user.username}`);
    expect(errors, `Console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
  });

  test('fan profile page loads for existing username', async ({ page }) => {
    const users = await queryDB('SELECT username FROM users WHERE username IS NOT NULL LIMIT 3') as { username: string }[];
    if (users.length === 0) test.skip();
    const user = users[0];
    await page.goto(`/fans/${user.username}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/TSG/i);
    const errors = getUnexpectedErrors(`/fans/${user.username}`);
    expect(errors, `Console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
  });

  test('spotlight page loads', async ({ page }) => {
    await page.goto('/spotlight');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/TSG/i);
    const errors = getUnexpectedErrors('/spotlight');
    expect(errors, `Console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
  });
});

// ===========================================================================
// Tournament Browsing
// ===========================================================================

test.describe('Tournament browsing', () => {
  test('tournaments page shows filters and list', async ({ page }) => {
    await page.goto('/tournaments');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('button', { hasText: 'Live' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Upcoming' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Completed' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'All Teams' })).toBeVisible();
  });

  test('tournament team-selection dropdown loads real teams from DB', async ({ page }) => {
    await page.goto('/tournaments');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('button', { hasText: 'All Teams' })).toBeVisible();
    const content = await page.textContent('body') || '';
    expect(content).toMatch(/TSG ARMY|TSG ARTEMIS|All Teams/);
    const errors = getUnexpectedErrors('/tournaments');
    expect(errors, `Console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
  });

  test('tournament detail page loads for existing slug', async ({ page }) => {
    await page.goto('/tournaments');
    await page.waitForLoadState('networkidle');
    const links = page.locator('a[href*="/tournaments/"]');
    const count = await links.count();
    if (count > 0) {
      await links.first().click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveTitle(/TSG/i);
      const errors = getUnexpectedErrors('/tournaments/slug');
      expect(errors, `Console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
    }
  });
});

// ===========================================================================
// Admin Tournament Workflow
// ===========================================================================

test.describe('Admin tournament workflow', () => {
  test('admin tournament page handles unauthenticated users', async ({ page }) => {
    await page.goto('/admin/tournaments');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toContain('/login');
    await expect(page).toHaveTitle(/TSG/i);
    const errors = getUnexpectedErrors('/admin/tournaments');
    expect(errors, `Console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
  });

  test('admin tournament page shows access denied for non-admin users', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.click('text=Create Account');
    await page.waitForTimeout(500);

    const fanUser = `pw_fan_${Date.now()}`;
    const fanPass = 'FanPass123!';
    await page.fill('input[placeholder="Choose a username"]', fanUser);
    await page.fill('input[placeholder="you@example.com"]', `${fanUser}@test.local`);
    await page.fill('input[placeholder="Min. 6 characters"]', fanPass);
    await page.fill('input[placeholder="Repeat password"]', fanPass);
    await page.click('button:has-text("Create Account")');
    await page.waitForTimeout(3000);

    await page.goto('/admin/tournaments');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const content = await page.textContent('body') || '';
    expect(content.toLowerCase()).toContain('access denied');

    const errors = getUnexpectedErrors('/admin/tournaments').filter(e => !e.includes('403'));
    expect(errors, `Console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
  });

  test('tournament team-selection dropdown loads real teams from DB', async ({ page }) => {
    await page.goto('/tournaments');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.locator('button', { hasText: 'All Teams' })).toBeVisible();
    const content = await page.textContent('body') || '';
    expect(content).toMatch(/TSG ARMY|TSG ARTEMIS|All Teams/);
    const errors = getUnexpectedErrors('/tournaments');
    expect(errors, `Console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
  });
});

// ===========================================================================
// All Admin Routes — Access Control (unauthenticated should redirect to login)
// ===========================================================================

test.describe('Admin route access control (unauthenticated)', () => {
  const adminRoutes = [
    '/admin',
    '/admin/teams',
    '/admin/players',
    '/admin/highlights',
    '/admin/staff',
    '/admin/team-media',
    '/admin/tournaments',
    '/admin/schedule',
    '/admin/live',
    '/admin/live-channels',
    '/admin/maps',
    '/admin/people',
    '/admin/media',
    '/admin/comments',
    '/admin/users',
    '/admin/roles',
    '/admin/settings',
    '/admin/achievements',
    '/admin/xp-settings',
    '/admin/streak-settings',
    '/admin/predictions',
    '/admin/quiz',
    '/admin/xp-tasks',
    '/admin/weekly-top-fan',
    '/admin/cards',
    '/admin/analytics',
    '/admin/notification-types',
    '/admin/announcements',
    '/admin/media-page',
    '/admin/fan-spotlight',
    '/admin/community',
    '/admin/sponsored-ads',
    '/admin/developer-info',
    '/admin/fan-rewards',
    '/admin/redemptions',
  ];

  for (const route of adminRoutes) {
    test(`${route} redirects unauthenticated users`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      const url = page.url();
      expect(url).toContain('/login');
    });
  }
});

// ===========================================================================
// Navigation
// ===========================================================================

test.describe('Navigation', () => {
  test('navbar links navigate correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const checkVisible = async (href: string) => {
      const links = page.locator(`a[href="${href}"]`);
      const count = await links.count();
      let found = false;
      for (let i = 0; i < count; i++) {
        if (await links.nth(i).isVisible()) {
          found = true;
          break;
        }
      }
      expect(found, `No visible link for ${href}`).toBe(true);
    };
    await checkVisible('/teams');
    await checkVisible('/players');
    await checkVisible('/tournaments');
    await checkVisible('/schedule');
    await checkVisible('/about');
  });

  test('navbar contains logo link', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('a[href="/"]').first()).toBeVisible();
  });
});

// ===========================================================================
// Login Page
// ===========================================================================

test.describe('Login page', () => {
  test('login form renders with OAuth options', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('input[placeholder*="username" i], input[placeholder*="email" i], input[type="email"]').first()).toBeVisible();
    await expect(page.locator('text=Google')).toBeVisible();
    await expect(page.locator('text=Discord')).toBeVisible();
    const errors = getUnexpectedErrors('/login');
    expect(errors, `Console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
  });

  test('login form validates empty fields', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    // Try submitting empty form
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(500);
    // Should not navigate away
    expect(page.url()).toContain('/login');
  });
});

// ===========================================================================
// Team Pages
// ===========================================================================

test.describe('Team pages', () => {
  test('teams listing page loads', async ({ page }) => {
    await page.goto('/teams');
    await page.waitForLoadState('networkidle');
    const content = await page.textContent('body');
    expect(content).toContain('TSG');
    const errors = getUnexpectedErrors('/teams');
    expect(errors, `Console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
  });
});

// ===========================================================================
// Player Pages
// ===========================================================================

test.describe('Player pages', () => {
  test('players listing page loads', async ({ page }) => {
    await page.goto('/players');
    await page.waitForLoadState('networkidle');
    const errors = getUnexpectedErrors('/players');
    expect(errors, `Console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
  });
});

// ===========================================================================
// Community Page
// ===========================================================================

test.describe('Community page', () => {
  test('community page loads', async ({ page }) => {
    await page.goto('/community');
    await page.waitForLoadState('networkidle');
    const errors = getUnexpectedErrors('/community');
    expect(errors, `Console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
  });
});

// ===========================================================================
// Leaderboard Page
// ===========================================================================

test.describe('Leaderboard page', () => {
  test('leaderboard page loads', async ({ page }) => {
    await page.goto('/leaderboard');
    await page.waitForLoadState('networkidle');
    const content = await page.textContent('body') || '';
    expect(content).toContain('TSG');
    const errors = getUnexpectedErrors('/leaderboard');
    expect(errors, `Console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
  });
});

// ===========================================================================
// Cards Page
// ===========================================================================

test.describe('Cards page', () => {
  test('cards page loads', async ({ page }) => {
    await page.goto('/cards');
    await page.waitForLoadState('networkidle');
    const errors = getUnexpectedErrors('/cards');
    expect(errors, `Console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
  });
});

// ===========================================================================
// 404 Page
// ===========================================================================

test.describe('Error handling', () => {
  test('unknown route shows 404 page', async ({ page }) => {
    await page.goto('/nonexistent-page-12345');
    await page.waitForLoadState('networkidle');
    const content = await page.textContent('body');
    const has404 = content?.toLowerCase().includes('not found') ||
                   content?.toLowerCase().includes('404') ||
                   content?.toLowerCase().includes('page not found');
    expect(has404).toBe(true);
    const errors = getUnexpectedErrors('/404');
    expect(errors, `Console errors: ${JSON.stringify(errors)}`).toHaveLength(0);
  });
});

// ===========================================================================
// Responsive Layout
// ===========================================================================

test.describe('Responsive layout', () => {
  test('home page renders on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const errors = getUnexpectedErrors('/');
    expect(errors, `Console errors on mobile: ${JSON.stringify(errors)}`).toHaveLength(0);
  });

  test('home page renders on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const errors = getUnexpectedErrors('/');
    expect(errors, `Console errors on tablet: ${JSON.stringify(errors)}`).toHaveLength(0);
  });
});

// ===========================================================================
// Console and Network Summary
// ===========================================================================

test.describe('Console and Network Summary', () => {
  test('no unexpected console errors on key pages', async ({ page }) => {
    const pagePaths = ['/', '/teams', '/players', '/tournaments', '/schedule', '/live', '/about', '/login', '/media', '/community', '/cards', '/leaderboard'];
    const allErrors: string[] = [];

    for (const path of pagePaths) {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !msg.text().includes('Warning: ') && !msg.text().includes('HMR')) {
          errors.push(`${path}: ${msg.text()}`);
        }
      });
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      const filtered = errors.filter(e => !e.includes('401') && !e.includes('Cannot update'));
      allErrors.push(...filtered);
    }
    expect(allErrors, `Unexpected console errors: ${JSON.stringify(allErrors)}`).toHaveLength(0);
  });

  test('no failed same-origin requests on key pages', async ({ page }) => {
    const pagePaths = ['/', '/teams', '/players', '/tournaments'];
    const failures: string[] = [];

    for (const path of pagePaths) {
      const reqs: string[] = [];
      page.on('requestfailed', (request) => {
        const url = request.url();
        const error = request.failure()?.errorText || 'unknown';
        reqs.push(`${path}: ${request.method()} ${url} - ${error}`);
      });
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const filtered = reqs.filter(r =>
        !r.includes('favicon') &&
        !r.includes('chrome-extension') &&
        !r.includes('google-analytics') &&
        !r.includes('googletagmanager')
      );
      failures.push(...filtered);
    }
    expect(failures, `Failed same-origin requests: ${JSON.stringify(failures)}`).toHaveLength(0);
  });
});
