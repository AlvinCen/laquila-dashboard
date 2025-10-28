
export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
};

export const formatIDRCompact = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return 'Rp 0';
    if (Math.abs(value) >= 1_000_000_000) {
        return `Rp ${(value / 1_000_000_000).toFixed(1).replace('.', ',')}M`;
    }
    if (Math.abs(value) >= 1_000_000) {
        return `Rp ${(value / 1_000_000).toFixed(1).replace('.', ',')}jt`;
    }
    if (Math.abs(value) >= 1_000) {
        return `Rp ${(value / 1_000).toFixed(0)}rb`;
    }
    return formatCurrency(value);
};


export const formatNumber = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return '0';
  return new Intl.NumberFormat('id-ID').format(amount);
};

export const toDateTimeLocal = (isoString: string | undefined | null): string => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    // Adjust for timezone offset to get local time in ISO format substring
    const tzoffset = date.getTimezoneOffset() * 60000; //offset in milliseconds
    const localISOTime = (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
    return localISOTime;
  } catch (e) {
    return '';
  }
};
