-- Security & performance indexes
-- Adds composite indexes for common query patterns and enforces constraints

-- Index for xp_history queries (recent XP history for a user)
CREATE INDEX IF NOT EXISTS xp_history_user_created_idx ON xp_history (userId, createdAt);

-- Index for comments moderation (filtering by hidden/pinned)
CREATE INDEX IF NOT EXISTS comments_hidden_created_idx ON comments (hidden, createdAt DESC);

-- Composite index for reward redemption duplicate-check (preventing duplicate pending redemptions)
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_user_reward_status ON reward_redemptions (userId, rewardId, status);

-- Index for content_comments queries (refTable, refId, hidden)
CREATE INDEX IF NOT EXISTS content_comments_ref_created_idx ON content_comments (refTable, refId, createdAt DESC);
