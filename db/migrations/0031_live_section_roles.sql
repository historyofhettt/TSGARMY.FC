-- Add live section enabled roles config to org_settings
-- Allows Admin to configure which roles can access the Live Channels section
ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS liveSectionEnabledRoles TEXT NULL;
