-- Supabase RLS 调试和修复脚本
-- 用于解决积分查询卡住的问题

-- 1. 检查当前用户的认证状态
SELECT 
    auth.uid() as current_user_id,
    auth.role() as current_role;

-- 2. 检查用户积分记录
SELECT * FROM user_credits 
WHERE user_id = 'aa480096-d7d8-4e5d-aa88-7500b8dc9d17';

-- 3. 查看现有的 RLS 策略
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'user_credits';

-- 4. 临时禁用 RLS 进行测试（仅用于调试）
-- ALTER TABLE user_credits DISABLE ROW LEVEL SECURITY;

-- 5. 重新启用并创建更宽松的策略
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- 删除旧策略
DROP POLICY IF EXISTS "Users can view own credits" ON user_credits;
DROP POLICY IF EXISTS "Users can update own credits" ON user_credits;

-- 创建新的策略（更宽松，用于调试）
CREATE POLICY "Allow all authenticated users to view their credits"
ON user_credits
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Allow all authenticated users to update their credits"
ON user_credits
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 6. 确保 anon 用户也能查看自己的积分
CREATE POLICY IF NOT EXISTS "Allow anon users to view their credits"
ON user_credits
FOR SELECT
TO anon
USING (user_id = auth.uid());

-- 7. 测试查询（请将 user_id 替换为实际的用户 ID）
-- SELECT * FROM user_credits WHERE user_id = auth.uid();

