-- ================================
-- 修复匿名用户积分初始化问题
-- ================================

-- 问题：匿名用户创建时没有正确获得10积分
-- 解决方案：改进 initialize_user_credits 函数，增加更好的错误处理和日志

-- 1. 改进 initialize_user_credits 函数
CREATE OR REPLACE FUNCTION initialize_user_credits(
  p_user_id UUID,
  p_initial_credits INTEGER DEFAULT 10,
  p_reason TEXT DEFAULT 'signup_bonus'
)
RETURNS VOID AS $$
DECLARE
  v_existing_credits INTEGER;
BEGIN
  -- 检查用户是否已经有积分记录
  SELECT credits INTO v_existing_credits
  FROM public.user_credits
  WHERE user_id = p_user_id;
  
  IF FOUND THEN
    -- 用户已存在积分记录，记录日志但不重复初始化
    RAISE LOG 'User % already has credits: %, skipping initialization', p_user_id, v_existing_credits;
    RETURN;
  END IF;
  
  -- 插入初始积分记录
  BEGIN
    INSERT INTO public.user_credits (user_id, credits, total_earned)
    VALUES (p_user_id, p_initial_credits, p_initial_credits);
    
    RAISE LOG 'Successfully created credits record for user %: % credits', p_user_id, p_initial_credits;
  EXCEPTION WHEN unique_violation THEN
    -- 如果发生唯一性冲突，记录日志但不报错（可能是并发操作）
    RAISE LOG 'Credits record already exists for user % (concurrent creation)', p_user_id;
    RETURN;
  END;
  
  -- 记录积分交易
  BEGIN
    INSERT INTO public.credit_transactions (user_id, amount, type, reason)
    VALUES (p_user_id, p_initial_credits, 'earn', p_reason);
    
    RAISE LOG 'Successfully created transaction record for user %', p_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- 记录错误但不影响主流程
    RAISE WARNING 'Failed to create transaction record for user %: %', p_user_id, SQLERRM;
  END;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 改进触发器函数，增加更详细的日志
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 记录新用户创建
  RAISE LOG 'New user created: %, is_anonymous: %', NEW.id, NEW.is_anonymous;
  
  -- 使用 BEGIN...EXCEPTION 捕获错误，防止用户注册失败
  BEGIN
    -- 为所有新用户（包括匿名用户）初始化 10 个积分
    IF NEW.is_anonymous = true THEN
      RAISE LOG 'Initializing credits for anonymous user: %', NEW.id;
      PERFORM initialize_user_credits(NEW.id, 10, 'anonymous_signup_bonus');
    ELSE
      RAISE LOG 'Initializing credits for regular user: %', NEW.id;
      PERFORM initialize_user_credits(NEW.id, 10, 'signup_bonus');
    END IF;
    
    RAISE LOG 'Successfully initialized credits for user %', NEW.id;
    
  EXCEPTION WHEN OTHERS THEN
    -- 记录错误但不阻止用户注册
    RAISE WARNING 'Failed to initialize credits for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 确保触发器存在
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 4. 创建一个辅助函数，用于强制初始化用户积分（即使已存在）
CREATE OR REPLACE FUNCTION force_initialize_user_credits(
  p_user_id UUID,
  p_initial_credits INTEGER DEFAULT 10,
  p_reason TEXT DEFAULT 'manual_init'
)
RETURNS JSONB AS $$
DECLARE
  v_existing_credits INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- 检查用户是否已经有积分记录
  SELECT credits INTO v_existing_credits
  FROM public.user_credits
  WHERE user_id = p_user_id;
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'user_already_has_credits',
      'current_balance', v_existing_credits,
      'message', '用户已有积分记录'
    );
  END IF;
  
  -- 插入初始积分记录
  INSERT INTO public.user_credits (user_id, credits, total_earned)
  VALUES (p_user_id, p_initial_credits, p_initial_credits)
  RETURNING credits INTO v_new_balance;
  
  -- 记录积分交易
  INSERT INTO public.credit_transactions (user_id, amount, type, reason)
  VALUES (p_user_id, p_initial_credits, 'earn', p_reason);
  
  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'message', '积分初始化成功'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 创建一个诊断函数，检查用户积分状态
CREATE OR REPLACE FUNCTION diagnose_user_credits(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_exists BOOLEAN;
  v_is_anonymous BOOLEAN;
  v_credits_record RECORD;
  v_transaction_count INTEGER;
BEGIN
  -- 检查用户是否存在
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    RETURN jsonb_build_object(
      'user_exists', false,
      'message', '用户不存在'
    );
  END IF;
  
  -- 获取用户信息
  SELECT is_anonymous INTO v_is_anonymous
  FROM auth.users
  WHERE id = p_user_id;
  
  -- 获取积分记录
  SELECT * INTO v_credits_record
  FROM public.user_credits
  WHERE user_id = p_user_id;
  
  -- 获取交易记录数量
  SELECT COUNT(*) INTO v_transaction_count
  FROM public.credit_transactions
  WHERE user_id = p_user_id;
  
  RETURN jsonb_build_object(
    'user_exists', true,
    'is_anonymous', v_is_anonymous,
    'has_credits_record', FOUND,
    'credits', COALESCE(v_credits_record.credits, 0),
    'total_earned', COALESCE(v_credits_record.total_earned, 0),
    'total_spent', COALESCE(v_credits_record.total_spent, 0),
    'transaction_count', v_transaction_count,
    'message', '诊断完成'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 授予必要的权限
GRANT EXECUTE ON FUNCTION initialize_user_credits TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION force_initialize_user_credits TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION diagnose_user_credits TO anon, authenticated, service_role;

-- 完成
SELECT '✅ 匿名用户积分初始化修复完成！' AS message;
SELECT '📝 使用 diagnose_user_credits(user_id) 函数检查用户积分状态' AS tip;
SELECT '🔧 使用 force_initialize_user_credits(user_id) 函数强制初始化用户积分' AS tip2;

