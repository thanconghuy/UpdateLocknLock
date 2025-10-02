-- Add must_change_password column to user_profiles table
-- This flag indicates if user must change their password on next login

-- Add column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles'
        AND column_name = 'must_change_password'
    ) THEN
        ALTER TABLE user_profiles
        ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE;

        RAISE NOTICE 'Column must_change_password added to user_profiles';
    ELSE
        RAISE NOTICE 'Column must_change_password already exists';
    END IF;
END $$;

-- Add comment to column
COMMENT ON COLUMN user_profiles.must_change_password IS
'Flag to force user to change password on next login. Set to true for new users with generated passwords.';

-- Create index for faster queries on users who need to change password
CREATE INDEX IF NOT EXISTS idx_user_profiles_must_change_password
ON user_profiles(must_change_password)
WHERE must_change_password = TRUE;

-- Update existing users to false (default)
UPDATE user_profiles
SET must_change_password = FALSE
WHERE must_change_password IS NULL;
