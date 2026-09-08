export type AccountingSale = {
  soldDate?: string;
  soldPrice: number;
  purchasePrice?: number;
  shippingCharged?: number;
  fees?: number;
  shipping?: number;
};

export type AccountingWriteOff = {
  effectiveDate: string;
  amount: number;
};

export type YearAccountingTotals = {
  year: number;
  saleCount: number;
  writeOffCount: number;
  revenue: number;
  shippingIncome: number;
  itemCost: number;
  fees: number;
  shippingCost: number;
  salesProfit: number;
  writeOffCost: number;
  netProfit: number;
};

function cents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function dateYear(value?: string) {
  const match = value?.match(/^(\d{4})-/);
  return match ? Number(match[1]) : undefined;
}

export function calculateYearAccounting(
  sales: readonly AccountingSale[],
  writeOffs: readonly AccountingWriteOff[],
  year: number,
): YearAccountingTotals {
  const includedSales = sales.filter((sale) => dateYear(sale.soldDate) === year);
  const includedWriteOffs = writeOffs.filter((writeOff) => dateYear(writeOff.effectiveDate) === year);
  const revenue = cents(includedSales.reduce((sum, sale) => sum + (sale.soldPrice || 0), 0));
  const shippingIncome = cents(includedSales.reduce((sum, sale) => sum + (sale.shippingCharged || 0), 0));
  const itemCost = cents(includedSales.reduce((sum, sale) => sum + (sale.purchasePrice || 0), 0));
  const fees = cents(includedSales.reduce((sum, sale) => sum + (sale.fees || 0), 0));
  const shippingCost = cents(includedSales.reduce((sum, sale) => sum + (sale.shipping || 0), 0));
  const salesProfit = cents(revenue + shippingIncome - itemCost - fees - shippingCost);
  const writeOffCost = cents(includedWriteOffs.reduce((sum, writeOff) => sum + (writeOff.amount || 0), 0));
  return {
    year,
    saleCount: includedSales.length,
    writeOffCount: includedWriteOffs.length,
    revenue,
    shippingIncome,
    itemCost,
    fees,
    shippingCost,
    salesProfit,
    writeOffCost,
    netProfit: cents(salesProfit - writeOffCost),
  };
}

