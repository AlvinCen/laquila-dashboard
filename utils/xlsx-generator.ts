import { CashFlowEntry, Wallet, Product, SalesOrder } from '../types';

// This function relies on the global ExcelJS object from the script tag in index.html
declare var ExcelJS: any;

export const exportCashFlowToXLSX = async (entries: CashFlowEntry[], wallets: Wallet[], periodLabel: string): Promise<Blob> => {
    if (typeof ExcelJS === 'undefined') {
        throw new Error("ExcelJS library is not available.");
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cash Flow');
    
    // --- Styles ---
    const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F4F4F' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
    };
    const thinBorder = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    const totalLabelStyle = { font: { bold: true }, alignment: { horizontal: 'right' } };
    const totalValueStyle = { font: { bold: true }, numFmt: '[$Rp-421] #,##0;([$Rp-421] #,##0)' };


    // --- Column Definitions ---
    worksheet.columns = [
        { header: 'Tanggal', key: 'tanggal', width: 14, style: { numFmt: 'dd mmm yyyy' } },
        { header: 'Tipe', key: 'tipe', width: 13 },
        { header: 'Kategori', key: 'kategori', width: 24 },
        { header: 'Wallet', key: 'wallet', width: 24 },
        { header: 'Deskripsi', key: 'deskripsi', width: 35 },
        { header: 'Masuk', key: 'masuk', width: 16, style: { numFmt: totalValueStyle.numFmt } },
        { header: 'Keluar', key: 'keluar', width: 16, style: { numFmt: totalValueStyle.numFmt } },
        { header: 'Transfer', key: 'transfer', width: 16, style: { numFmt: totalValueStyle.numFmt } },
    ];

    // --- Main Headers ---
    // Rows 1 and 2 are empty for spacing
    worksheet.addRow([]);
    worksheet.addRow([]);
    
    // Title on row 3, merged across D and E
    const titleRow = worksheet.getRow(3);
    const titleCell = titleRow.getCell('D');
    titleCell.value = 'CASH FLOW LAQUILA MANUFACTURE';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center' };
    worksheet.mergeCells('D3:E3');

    // Period on row 4, merged across D and E
    const periodRow = worksheet.getRow(4);
    const periodCell = periodRow.getCell('D');
    periodCell.value = `PERIODE ${periodLabel}`;
    periodCell.font = { size: 12, bold: true };
    periodCell.alignment = { horizontal: 'center' };
    worksheet.mergeCells('D4:E4');


    // --- Table Header Formatting ---
    const tableHeaderRow = worksheet.getRow(5);
    tableHeaderRow.eachCell((cell) => {
        cell.style = headerStyle;
        cell.border = thinBorder;
    });

    // --- Data Processing ---
    const getWalletName = (id: string) => wallets.find(w => w.id === id)?.name || id;
    let totalIncome = 0;
    let totalExpense = 0;
    let totalTransfer = 0;

    entries.forEach(entry => {
        let income = null;
        let expense = null;
        let transfer = null;
        let walletInfo = getWalletName(entry.walletId);

        switch (entry.type) {
            case 'income':
                income = entry.jumlah;
                totalIncome += entry.jumlah;
                break;
            case 'expense':
                expense = entry.jumlah;
                totalExpense += entry.jumlah;
                break;
            case 'transfer':
                transfer = entry.jumlah;
                totalTransfer += entry.jumlah;
                walletInfo = `${getWalletName(entry.walletId)} → ${getWalletName(entry.toWalletId || '')}`;
                break;
        }
        
        const rowData = {
            tanggal: new Date(entry.tanggal + 'T00:00:00Z'), // FIX: Parse date as UTC to prevent timezone shifts
            tipe: entry.type.charAt(0).toUpperCase() + entry.type.slice(1),
            kategori: entry.kategori || '-',
            wallet: walletInfo,
            deskripsi: entry.deskripsi,
            masuk: income,
            keluar: expense,
            transfer: transfer
        };
        const newRow = worksheet.addRow(rowData);
        newRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.border = thinBorder;
        });
    });

    // --- Totals Section ---
    const netChange = totalIncome - totalExpense;
    worksheet.addRow([]); // Spacer
    
    const totalsData = [
        { label: 'Total Masuk', value: totalIncome },
        { label: 'Total Keluar', value: totalExpense },
        { label: 'Total Transfer', value: totalTransfer },
        { label: 'NET (Masuk − Keluar)', value: netChange },
    ];

    totalsData.forEach(item => {
        const row = worksheet.addRow(['', '', '', '', item.label, item.value]);
        const labelCell = row.getCell(5);
        const valueCell = row.getCell(6);
        labelCell.style = totalLabelStyle;
        valueCell.style = totalValueStyle;
    });

    // --- View Properties ---
    worksheet.views = [{ state: 'frozen', ySplit: 5 }];
    worksheet.autoFilter = 'A5:H5';
    
    // --- Generate File ---
    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheet.sheet' });
};

export const exportProductsToXLSX = async (products: Product[]): Promise<Blob> => {
    if (typeof ExcelJS === 'undefined') {
        throw new Error("ExcelJS library is not available.");
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Daftar Produk');

    // --- Styles ---
    const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F4F4F' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
    };
    const thinBorder = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    const currencyStyle = { numFmt: '[$Rp-421] #,##0;([$Rp-421] #,##0)' };

    // --- Column Definitions ---
    worksheet.columns = [
        { header: 'Kode Produk', key: 'kodeProduk', width: 20 },
        { header: 'Nama Produk', key: 'namaProduk', width: 40 },
        { header: 'Tahun HPP', key: 'tahunHpp', width: 15, style: { alignment: { horizontal: 'center' } } },
        { header: 'Harga Dasar', key: 'hargaDasar', width: 20, style: currencyStyle },
        { header: 'Print Kelengkapan', key: 'printKelengkapan', width: 50 },
    ];

    // --- Header Formatting ---
    const tableHeaderRow = worksheet.getRow(1);
    tableHeaderRow.eachCell((cell) => {
        cell.style = headerStyle;
        cell.border = thinBorder;
    });

    // --- Data Rows ---
    products.forEach(product => {
        const rowData = {
            ...product
        };
        const newRow = worksheet.addRow(rowData);
        newRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.border = thinBorder;
        });
    });

    // --- View Properties ---
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.autoFilter = 'A1:E1';

    // --- Generate File ---
    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheet.sheet' });
};
