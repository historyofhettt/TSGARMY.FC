-- Sponsored Ads display control fields for ad_creatives
-- Adds layout, targeting, visibility, and design customization fields

ALTER TABLE ad_creatives
  ADD COLUMN layout ENUM('banner', 'card', 'image_only', 'video', 'native') DEFAULT 'card' NOT NULL,
  ADD COLUMN logoKey VARCHAR(512) NULL,
  ADD COLUMN secondaryLinkUrl VARCHAR(1024) NULL,
  ADD COLUMN secondaryLinkLabel VARCHAR(128) NULL,
  ADD COLUMN targetPages TEXT NULL,
  ADD COLUMN desktopVisible TINYINT(1) DEFAULT 1 NOT NULL,
  ADD COLUMN mobileVisible TINYINT(1) DEFAULT 1 NOT NULL,
  ADD COLUMN width VARCHAR(64) NULL,
  ADD COLUMN height VARCHAR(64) NULL,
  ADD COLUMN aspectRatio VARCHAR(32) NULL,
  ADD COLUMN alignment ENUM('left', 'center', 'right') DEFAULT 'center' NOT NULL,
  ADD COLUMN backgroundColor VARCHAR(64) NULL,
  ADD COLUMN borderColor VARCHAR(64) NULL,
  ADD COLUMN textColor VARCHAR(64) NULL,
  ADD COLUMN showBorder TINYINT(1) DEFAULT 0 NOT NULL,
  ADD COLUMN showShadow TINYINT(1) DEFAULT 0 NOT NULL,
  ADD COLUMN textPosition ENUM('top', 'bottom', 'overlay', 'outside') DEFAULT 'bottom' NOT NULL,
  ADD COLUMN ctaStyle ENUM('filled', 'outline', 'text') DEFAULT 'filled' NOT NULL,
      ADD COLUMN previewImageKey VARCHAR(512) NULL,
  ADD COLUMN advertiser VARCHAR(255) NULL;

-- Sponsored Ads campaign scheduling and control fields
ALTER TABLE ad_campaigns
  ADD COLUMN priority INT DEFAULT 0 NOT NULL,
  ADD COLUMN impressionLimit INT NULL;
