-- ================================
-- 修复触发器权限问题
-- ================================

-- 1. 删除并重建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- 2. 重新创建触发器函数（添加错误处理和日志）
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 使用 BEGIN...EXCEPTION 捕获错误，防止用户注册失败
  BEGIN
    -- 为所有新用户初始化 10 个积分
    -- 使用 INSERT...ON CONFLICT DO NOTHING 避免重复插入
    INSERT INTO public.user_credits (user_id, credits, total_earned)
    VALUES (NEW.id, 10, 10)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- 记录交易
    INSERT INTO public.credit_transactions (user_id, amount, type, reason)
    VALUES (NEW.id, 10, 'earn', 'signup_bonus');
    
    RAISE LOG 'Successfully initialized credits for user %', NEW.id;
    
  EXCEPTION WHEN OTHERS THEN
    -- 记录错误但不阻止用户注册
    RAISE WARNING 'Failed to initialize credits for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 重新创建触发器
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 4. 授予函数必要的权限
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.user_credits TO postgres, service_role;
GRANT ALL ON public.credit_transactions TO postgres, service_role;
GRANT SELECT, INSERT ON public.user_credits TO anon, authenticated;
GRANT SELECT, INSERT ON public.credit_transactions TO anon, authenticated;

-- 5. 测试触发器（可选）
-- SELECT * FROM public.user_credits;
-- SELECT * FROM public.credit_transactions;

SELECT '✅ 触发器已修复！现在请重新尝试注册。' AS message;

