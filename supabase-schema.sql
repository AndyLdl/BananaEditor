-- ================================
-- Supabase 数据库架构
-- BananaEditor 积分系统
-- ================================

-- 1. 用户积分表
CREATE TABLE IF NOT EXISTS user_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  credits INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 为用户积分表创建索引
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);

-- 2. 积分交易记录表
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earn', 'spend')),
  reason TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 为交易记录表创建索引
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);

-- 3. 启用行级安全策略 (RLS)
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- 4. 创建 RLS 策略

-- 先删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can view own credits" ON user_credits;
DROP POLICY IF EXISTS "Users can view own transactions" ON credit_transactions;

-- 用户只能查看自己的积分
CREATE POLICY "Users can view own credits" 
ON user_credits FOR SELECT 
USING (auth.uid() = user_id);

-- 用户只能查看自己的交易记录
CREATE POLICY "Users can view own transactions" 
ON credit_transactions FOR SELECT 
USING (auth.uid() = user_id);

-- 5. 创建触发器：自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_credits_updated_at
BEFORE UPDATE ON user_credits
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 6. 创建函数：初始化用户积分（首次创建用户时）
CREATE OR REPLACE FUNCTION initialize_user_credits(
  p_user_id UUID,
  p_initial_credits INTEGER DEFAULT 10,
  p_reason TEXT DEFAULT 'signup_bonus'
)
RETURNS VOID AS $$
BEGIN
  -- 插入初始积分记录
  INSERT INTO user_credits (user_id, credits, total_earned)
  VALUES (p_user_id, p_initial_credits, p_initial_credits)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- 记录积分交易
  INSERT INTO credit_transactions (user_id, amount, type, reason)
  VALUES (p_user_id, p_initial_credits, 'earn', p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 创建函数：增加积分
CREATE OR REPLACE FUNCTION add_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- 更新用户积分
  UPDATE user_credits
  SET 
    credits = credits + p_amount,
    total_earned = total_earned + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING credits INTO v_new_balance;
  
  -- 如果用户不存在，创建记录
  IF NOT FOUND THEN
    INSERT INTO user_credits (user_id, credits, total_earned)
    VALUES (p_user_id, p_amount, p_amount)
    RETURNING credits INTO v_new_balance;
  END IF;
  
  -- 记录交易
  INSERT INTO credit_transactions (user_id, amount, type, reason, metadata)
  VALUES (p_user_id, p_amount, 'earn', p_reason, p_metadata);
  
  -- 返回结果
  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'amount_added', p_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 创建函数：扣除积分
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- 获取当前余额
  SELECT credits INTO v_current_balance
  FROM user_credits
  WHERE user_id = p_user_id;
  
  -- 检查用户是否存在
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'user_not_found',
      'message', '用户不存在'
    );
  END IF;
  
  -- 检查余额是否充足
  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'message', '积分不足',
      'current_balance', v_current_balance,
      'required', p_amount
    );
  END IF;
  
  -- 扣除积分
  UPDATE user_credits
  SET 
    credits = credits - p_amount,
    total_spent = total_spent + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING credits INTO v_new_balance;
  
  -- 记录交易
  INSERT INTO credit_transactions (user_id, amount, type, reason, metadata)
  VALUES (p_user_id, p_amount, 'spend', p_reason, p_metadata);
  
  -- 返回结果
  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'amount_deducted', p_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. 创建函数：获取用户积分余额
CREATE OR REPLACE FUNCTION get_user_credits(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_credits_record RECORD;
BEGIN
  SELECT * INTO v_credits_record
  FROM user_credits
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'user_not_found'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'credits', v_credits_record.credits,
    'total_earned', v_credits_record.total_earned,
    'total_spent', v_credits_record.total_spent
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. 创建触发器：当新用户注册时自动初始化积分
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 为新用户初始化积分
  -- 匿名用户获得 10 积分
  -- 正式用户根据来源判断
  IF NEW.is_anonymous = true THEN
    PERFORM initialize_user_credits(NEW.id, 10, 'anonymous_signup_bonus');
  ELSE
    PERFORM initialize_user_credits(NEW.id, 10, 'signup_bonus');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();

-- 11. 创建函数：升级匿名用户为正式用户
CREATE OR REPLACE FUNCTION upgrade_anonymous_user(
  p_user_id UUID,
  p_bonus_credits INTEGER DEFAULT 10
)
RETURNS JSONB AS $$
BEGIN
  -- 给升级的用户额外赠送积分
  PERFORM add_credits(
    p_user_id,
    p_bonus_credits,
    'login_bonus',
    jsonb_build_object('upgraded_from', 'anonymous')
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'bonus_credits', p_bonus_credits,
    'message', '账户升级成功'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================
-- 完成！
-- ================================
-- 
-- 使用说明：
-- 1. 在 Supabase Dashboard 中执行此 SQL 脚本
-- 2. 确保 auth.users 表已经存在（Supabase 自动创建）
-- 3. 测试函数是否正常工作

