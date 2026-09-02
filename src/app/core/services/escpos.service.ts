import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Sale, CashSession, Customer } from '../models';
import { TefTransaction } from './tef-driver.service';

@Injectable({ providedIn: 'root' })
export class EscPosService {
  private platformId = inject(PLATFORM_ID);

  /**
   * Formats a standard 80mm/58mm thermal receipt layout for sales.
   */
  generateSaleReceipt(sale: Sale, companyName = '3EATCRU EXPRESS STORE', cnpj = '12.345.678/0001-90'): string {
    const divider = '------------------------------------------------';
    const dateStr = new Date(sale.createdAt).toLocaleString('pt-BR');

    const lines: string[] = [
      companyName,
      `CNPJ: ${cnpj}`,
      'DOCUMENTO AUXILIAR DE VENDA (NFC-e / SAT)',
      divider,
      `CUPOM: ${sale.code} | DATA: ${dateStr}`,
      `OPERADOR: ${sale.operatorName}`,
      sale.customerName ? `CLIENTE: ${sale.customerName}` : 'CONSUMIDOR NAO IDENTIFICADO',
      divider,
      'ITEM  CODIGO         DESC          QTD x UNIT    TOTAL',
      divider
    ];

    sale.items.forEach((item, index) => {
      const idx = (index + 1).toString().padStart(2, '0');
      const desc = item.productName.substring(0, 20).padEnd(20, ' ');
      const qtyPrice = `${item.quantity} x R$${item.unitPrice.toFixed(2)}`.padEnd(14, ' ');
      const total = `R$ ${item.totalPrice.toFixed(2)}`.padStart(10, ' ');
      lines.push(`${idx}    ${desc} ${qtyPrice} ${total}`);
    });

    lines.push(divider);
    lines.push(`SUBTOTAL:                      R$ ${sale.subtotal.toFixed(2)}`);
    if (sale.discount > 0) {
      lines.push(`DESCONTO:                    - R$ ${sale.discount.toFixed(2)}`);
    }
    lines.push(`TOTAL A PAGAR:                 R$ ${sale.total.toFixed(2)}`);
    lines.push(divider);
    lines.push('FORMAS DE PAGAMENTO:');
    sale.payments.forEach(p => {
      const method = p.method.toUpperCase().padEnd(20, ' ');
      const amt = `R$ ${p.amount.toFixed(2)}`.padStart(15, ' ');
      lines.push(`  ${method} ${amt}`);
      if (p.changeAmount && p.changeAmount > 0) {
        lines.push(`  TROCO:                       R$ ${p.changeAmount.toFixed(2)}`);
      }
    });

    lines.push(divider);
    lines.push('       OBRIGADO PELA PREFERENCIA! VOLTE SEMPRE       ');
    lines.push('             SISTEMA: 3EATCRU OS VAREJO             ');
    lines.push('\n\n\n');

    return lines.join('\n');
  }

  /**
   * Formats a Cash Drawer Closing receipt (Redução Z / Leitura X)
   */
  generateCashCloseReceipt(session: CashSession): string {
    const divider = '================================================';
    const dateOpen = new Date(session.openedAt).toLocaleString('pt-BR');
    const dateClose = session.closedAt ? new Date(session.closedAt).toLocaleString('pt-BR') : 'EM ABERTO';

    let totalVendas = 0;
    let totalSuprimentos = 0;
    let totalSangrias = 0;
    let totalFiado = 0;

    session.movements.forEach(m => {
      if (m.type === 'VENDA') totalVendas += m.amount;
      if (m.type === 'SUPRIMENTO') totalSuprimentos += m.amount;
      if (m.type === 'SANGRIA') totalSangrias += m.amount;
      if (m.type === 'PAGAMENTO_FIADO') totalFiado += m.amount;
    });

    const lines: string[] = [
      '              3EATCRU OS - CONTROLE DE CAIXA             ',
      '          RELATORIO DE FECHAMENTO DE TURNO / Z          ',
      divider,
      `ID TURNO: ${session.id}`,
      `OPERADOR: ${session.operatorName}`,
      `ABERTURA: ${dateOpen}`,
      `FECHAMENTO: ${dateClose}`,
      divider,
      `(+) FUNDO DE ABERTURA:        R$ ${session.initialCash.toFixed(2)}`,
      `(+) VENDAS EM DINHEIRO:       R$ ${totalVendas.toFixed(2)}`,
      `(+) SUPRIMENTOS (ENTRADAS):   R$ ${totalSuprimentos.toFixed(2)}`,
      `(+) RECEBIMENTOS DE FIADO:    R$ ${totalFiado.toFixed(2)}`,
      `(-) SANGRIA (RETIRADAS):      R$ ${totalSangrias.toFixed(2)}`,
      divider,
      `(=) SALDO EM GAVETA CALCULADO: R$ ${(session.finalCashCalculated || 0).toFixed(2)}`,
      `(=) VALOR DECLARADO NA CONTAGEM: R$ ${(session.finalCashDeclared || 0).toFixed(2)}`,
      `DIFERENCA DE CAIXA (QUEBRA):   R$ ${(session.cashDifference || 0).toFixed(2)}`,
      divider,
      'ASSINATURA DO OPERADOR: __________________________',
      '\n\n\n'
    ];

    return lines.join('\n');
  }

  /**
   * Formats a scale adhesive label (60x40mm) for pesáveis items with EAN-13 barcode
   */
  generateScaleLabel(data: { 
    companyName?: string;
    productName: string; 
    weight: number; 
    unitPrice: number; 
    totalPrice: number; 
    barcode: string;
    packedAt?: number;
    validDays?: number;
  }): string {
    const divider = '----------------------------------------';
    const packed = new Date(data.packedAt || Date.now()).toLocaleDateString('pt-BR');
    const validUntil = new Date((data.packedAt || Date.now()) + (data.validDays || 5) * 86400000).toLocaleDateString('pt-BR');

    return [
      '========================================',
      `        ${(data.companyName || '3EATCRU GOURMET & HORTIFRUTI').toUpperCase()}`,
      '========================================',
      `PRODUTO: ${data.productName.toUpperCase()}`,
      divider,
      `EMBALADO EM: ${packed} | VALIDADE: ${validUntil}`,
      `PESO LIQUIDO:             ${data.weight.toFixed(3)} kg`,
      `PRECO POR KG:             R$ ${data.unitPrice.toFixed(2)}`,
      divider,
      `TOTAL A PAGAR:            R$ ${data.totalPrice.toFixed(2)}`,
      '========================================',
      `        |||| ||| ||||| |||| |||||       `,
      `             ${data.barcode}            `,
      '========================================',
      '\n\n'
    ].join('\n');
  }

  /**
   * Generates formatted receipt for TEF Card Slip (Via Cliente / Via Loja)
   */
  generateTefReceipt(tef: TefTransaction, copy: 'CLIENTE' | 'ESTABELECIMENTO'): string {
    return copy === 'CLIENTE' ? tef.customerSlip : tef.merchantSlip;
  }

  /**
   * Opens standard browser print dialog for thermal receipt.
   */
  printReceipt(text: string) {
    if (!isPlatformBrowser(this.platformId) || typeof window === 'undefined') return;

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Comprovante Térmico - 3eatcru OS</title>
            <style>
              body {
                font-family: 'Courier New', Courier, monospace;
                font-size: 12px;
                padding: 10px;
                white-space: pre-wrap;
                line-height: 1.2;
                color: #000;
              }
              @media print {
                @page { margin: 0; }
                body { margin: 0.5cm; }
              }
            </style>
          </head>
          <body>${text}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  }
}
