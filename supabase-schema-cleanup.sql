-- ================================
-- Supabase 数据库清理脚本
-- 在重新初始化前运行此脚本
-- ================================

-- 1. 删除所有 RLS 策略
DROP POLICY IF EXISTS "Users can view own credits" ON user_credits;
DROP POLICY IF EXISTS "Users can view own transactions" ON credit_transactions;
DROP POLICY IF EXISTS "Service role can insert credits" ON user_credits;
DROP POLICY IF EXISTS "Service role can insert transactions" ON credit_transactions;

-- 2. 删除触发器
DROP TRIGGER IF EXISTS update_user_credits_updated_at ON user_credits;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;

-- 3. 删除函数（CASCADE 会自动删除依赖的触发器）
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS initialize_user_credits(UUID, INTEGER, TEXT) CASCADE;
DROP FUNCTION IF EXISTS add_credits(UUID, INTEGER, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS deduct_credits(UUID, INTEGER, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- 4. 删除表（CASCADE 会自动删除依赖的索引和约束）
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS user_credits CASCADE;

-- 完成！现在可以运行 supabase-schema.sql 重新创建所有对象
SELECT '✅ 清理完成！现在请运行 supabase-schema.sql 初始化数据库。' AS message;

