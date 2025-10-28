/**
 * 积分套餐配置
 * 为未来支付功能预留
 */

export interface CreditPackage {
    id: number;
    name: string;
    credits: number;
    price: number;
    popular?: boolean;
    bonus?: number; // 额外赠送的积分
    savings?: string; // 节省百分比
}

export const CREDIT_PACKAGES: CreditPackage[] = [
    {
        id: 1,
        name: '入门套餐',
        credits: 100,
        price: 9.99,
        popular: false,
    },
    {
        id: 2,
        name: '标准套餐',
        credits: 500,
        price: 39.99,
        popular: true,
        bonus: 50,
        savings: '20%',
    },
    {
        id: 3,
        name: '专业套餐',
        credits: 1000,
        price: 69.99,
        popular: false,
        bonus: 150,
        savings: '30%',
    },
    {
        id: 4,
        name: '企业套餐',
        credits: 5000,
        price: 299.99,
        popular: false,
        bonus: 1000,
        savings: '40%',
    },
];

// 积分单价计算（每个积分的价格）
export function calculatePricePerCredit(packageItem: CreditPackage): number {
    const totalCredits = packageItem.credits + (packageItem.bonus || 0);
    return packageItem.price / totalCredits;
}

// 获取推荐套餐
export function getPopularPackage(): CreditPackage | undefined {
    return CREDIT_PACKAGES.find(pkg => pkg.popular);
}

// 根据ID获取套餐
export function getPackageById(id: number): CreditPackage | undefined {
    return CREDIT_PACKAGES.find(pkg => pkg.id === id);
}

