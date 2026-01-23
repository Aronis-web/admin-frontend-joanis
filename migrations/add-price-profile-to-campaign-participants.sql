-- Migration: Add price_profile_id to campaign_participants
-- Description: Adds price profile support to campaign participants for automatic sale amount calculation
-- Date: 2024

-- Add price_profile_id column to campaign_participants table
ALTER TABLE campaign_participants
ADD COLUMN price_profile_id UUID;

-- Add foreign key constraint to price_profiles table
ALTER TABLE campaign_participants
ADD CONSTRAINT fk_campaign_participants_price_profile
FOREIGN KEY (price_profile_id)
REFERENCES price_profiles(id)
ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_campaign_participants_price_profile_id
ON campaign_participants(price_profile_id);

-- Add comment to the column
COMMENT ON COLUMN campaign_participants.price_profile_id IS 'Optional price profile for automatic sale amount calculation based on cost factor';
