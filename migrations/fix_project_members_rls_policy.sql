-- =====================================================
-- FIX: Add RLS policy for users to view their own memberships
-- =====================================================

-- Current: Only admins can access project_members table
-- Fix: Allow users to see their own membership records

-- Add policy for users to SELECT their own records
CREATE POLICY "users_view_own_memberships"
ON project_members FOR SELECT
USING (
  user_id = auth.uid()
);

-- Verify policies
SELECT
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'project_members';

SELECT '✅ Added RLS policy: users can view their own project memberships' as status;
