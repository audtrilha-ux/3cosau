import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { IdGeneratorService } from './id-generator.service';
import { AppContextService } from './app-context.service';

export type TefProvider = 'SITEF' | 'PAYGO' | 'STONE_TEF' | 'CIELO_TEF';
export type TefPaymentType = 'DEBITO' | 'CREDITO_A_VISTA' | 'CREDITO_PARCELADO' | 'VOUCHER' | 'PIX_PINPAD';
export type TefPinpadState = 
  | 'IDLE' 
  | 'WAITING_CARD' 
  | 'READING_CARD' 
  | 'WAITING_PASSWORD' 
  | 'PROCESSING_AUTHORIZER' 
  | 'APPROVED' 
  | 'DENIED' 
  | 'CANCELLED';

export interface TefTransaction {
  id: string;
  saleId?: string;
  companyId: string;
  nsu: string; // Ex: 492019
  authCode: string; // Ex: 084120
  provider: TefProvider;
  amount: number;
  paymentType: TefPaymentType;
  installments: number;
  brand: 'VISA' | 'MASTERCARD' | 'ELO' | 'AMEX' | 'HIPERCARD' | 'ALELO' | 'SODEXO' | 'PIX';
  cardMasked: string; // Ex: ****.****.****.4812
  status: 'APPROVED' | 'DENIED' | 'CANCELLED' | 'REFUNDED';
  customerSlip: string;
  merchantSlip: string;
  timestamp: number;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class TefDriverService {
  private platformId = inject(PLATFORM_ID);
  private idGen = inject(IdGeneratorService);
  private context = inject(AppContextService);

  // Core TEF Configuration & Status
  readonly isConnected = signal<boolean>(true);
  readonly provider = signal<TefProvider>('SITEF');
  readonly terminalId = signal<string>('SE0001');
  readonly merchantId = signal<string>('3EATCRU_MERCHANT_902');
  readonly pinpadModel = signal<string>('Gertec PPC930 / Verifone VX820');

  // Interactive Pinpad State Machine
  readonly pinpadState = signal<TefPinpadState>('IDLE');
  readonly pinpadLcdLine1 = signal<string>('3EATCRU TEF DEDICADO');
  readonly pinpadLcdLine2 = signal<string>('AGUARDANDO CAIXA...');
  readonly passwordDigitsEntered = signal<number>(0);
  readonly isTransactionInProgress = signal<boolean>(false);

  // Active Transaction Buffer
  readonly activeTransaction = signal<TefTransaction | null>(null);
  readonly transactionsHistory = signal<TefTransaction[]>([]);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadRecentHistory();
    }
  }

  private loadRecentHistory() {
    try {
      const saved = localStorage.getItem('3eatcru_tef_history');
      if (saved) {
        this.transactionsHistory.set(JSON.parse(saved));
      }
    } catch {
      /* ignore storage read error */
    }
  }

  private saveHistory(history: TefTransaction[]) {
    this.transactionsHistory.set(history);
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem('3eatcru_tef_history', JSON.stringify(history.slice(0, 50)));
      } catch {
        /* ignore storage write error */
      }
    }
  }

  /**
   * Resets Pinpad LCD display to Idle State
   */
  resetPinpad() {
    this.pinpadState.set('IDLE');
    this.pinpadLcdLine1.set('3EATCRU OS - POS');
    this.pinpadLcdLine2.set('INSIRA OU APROXIME');
    this.passwordDigitsEntered.set(0);
    this.isTransactionInProgress.set(false);
  }

  /**
   * Initiates a full TEF electronic payment flow with simulated or connected Pinpad interaction
   */
  async processTefPayment(params: {
    amount: number;
    paymentType: TefPaymentType;
    installments?: number;
    saleId?: string;
    saleCode?: string;
  }): Promise<{ success: boolean; transaction?: TefTransaction; message: string }> {
    if (this.isTransactionInProgress()) {
      return { success: false, message: 'Já existe uma transação TEF em andamento no Pinpad.' };
    }

    this.isTransactionInProgress.set(true);
    const compId = this.context.companyId() || 'EMP_001';
    const compName = this.context.companyName() || '3EATCRU EXPRESS';

    try {
      // Step 1: Prompt customer to tap/insert card on Pinpad
      this.pinpadState.set('WAITING_CARD');
      this.pinpadLcdLine1.set(`VALOR: R$ ${params.amount.toFixed(2)}`);
      this.pinpadLcdLine2.set('APROXIME OU INSIRA');

      await this.sleep(1200);

      // Step 2: Card Detected / Reading Chip or NFC Contactless
      this.pinpadState.set('READING_CARD');
      this.pinpadLcdLine1.set('LENDO CARTAO...');
      this.pinpadLcdLine2.set('NAO REMOVA O CARTAO');

      await this.sleep(1000);

      // Step 3: PIN Entry (if applicable)
      if (params.paymentType !== 'PIX_PINPAD') {
        this.pinpadState.set('WAITING_PASSWORD');
        this.pinpadLcdLine1.set('DIGITE SUA SENHA:');
        
        // Simulate password entry animation
        this.passwordDigitsEntered.set(1);
        this.pinpadLcdLine2.set('*');
        await this.sleep(400);

        this.passwordDigitsEntered.set(2);
        this.pinpadLcdLine2.set('* *');
        await this.sleep(350);

        this.passwordDigitsEntered.set(3);
        this.pinpadLcdLine2.set('* * *');
        await this.sleep(400);

        this.passwordDigitsEntered.set(4);
        this.pinpadLcdLine2.set('* * * * [ENTER]');
        await this.sleep(500);
      } else {
        // PIX on Pinpad: Show QR Confirmation
        this.pinpadState.set('WAITING_PASSWORD');
        this.pinpadLcdLine1.set('PIX PINPAD: R$ ' + params.amount.toFixed(2));
        this.pinpadLcdLine2.set('AGUARDANDO PAGAMENTO');
        await this.sleep(1800);
      }

      // Step 4: Connecting to Authorizer (SiTEF / PayGo / Stone)
      this.pinpadState.set('PROCESSING_AUTHORIZER');
      this.pinpadLcdLine1.set('PROCESSANDO...');
      this.pinpadLcdLine2.set('COMUNICANDO REDE');

      await this.sleep(1400);

      // Step 5: Success & Slip Generation
      const nsu = Math.floor(100000 + Math.random() * 900000).toString();
      const authCode = Math.floor(100000 + Math.random() * 900000).toString();
      const brands: ('VISA' | 'MASTERCARD' | 'ELO' | 'AMEX' | 'HIPERCARD')[] = ['VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPERCARD'];
      const chosenBrand = params.paymentType === 'PIX_PINPAD' ? 'PIX' : brands[Math.floor(Math.random() * brands.length)];
      const last4 = Math.floor(1000 + Math.random() * 9000).toString();

      const transaction: TefTransaction = {
        id: this.idGen.generatePrefixedId('tef'),
        saleId: params.saleId,
        companyId: compId,
        nsu,
        authCode,
        provider: this.provider(),
        amount: params.amount,
        paymentType: params.paymentType,
        installments: params.installments || 1,
        brand: chosenBrand as any,
        cardMasked: params.paymentType === 'PIX_PINPAD' ? 'CHAVE PIX DINAMICA' : `****.****.****.${last4}`,
        status: 'APPROVED',
        timestamp: Date.now(),
        message: 'TRANSACAO APROVADA COM SUCESSO',
        customerSlip: this.generateSlipContent({
          compName,
          type: params.paymentType,
          brand: chosenBrand,
          amount: params.amount,
          nsu,
          authCode,
          cardMasked: `****.****.****.${last4}`,
          copy: 'CLIENTE',
          provider: this.provider()
        }),
        merchantSlip: this.generateSlipContent({
          compName,
          type: params.paymentType,
          brand: chosenBrand,
          amount: params.amount,
          nsu,
          authCode,
          cardMasked: `****.****.****.${last4}`,
          copy: 'ESTABELECIMENTO',
          provider: this.provider()
        })
      };

      // Step 6: Confirmation UI & LCD
      this.pinpadState.set('APPROVED');
      this.pinpadLcdLine1.set('APROVADA - SUCESSO');
      this.pinpadLcdLine2.set('RETIRE O CARTAO');

      this.activeTransaction.set(transaction);
      this.saveHistory([transaction, ...this.transactionsHistory()]);

      setTimeout(() => {
        this.resetPinpad();
      }, 3000);

      return {
        success: true,
        transaction,
        message: `Transação TEF aprovada com sucesso! NSU: ${nsu} | Aut: ${authCode}`
      };
    } catch (err: any) {
      this.pinpadState.set('DENIED');
      this.pinpadLcdLine1.set('TRANSACAO RECUSADA');
      this.pinpadLcdLine2.set('ERRO DE COMUNICACAO');
      setTimeout(() => this.resetPinpad(), 3000);
      return { success: false, message: 'Falha no processamento TEF: ' + (err?.message || 'Erro desconhecido') };
    } finally {
      this.isTransactionInProgress.set(false);
    }
  }

  /**
   * Cancels/Refunds a prior TEF transaction (Estorno TEF / CNC)
   */
  async cancelTefTransaction(nsu: string, authCode: string, amount: number): Promise<{ success: boolean; message: string; slip?: string }> {
    const list = this.transactionsHistory();
    const target = list.find(t => t.nsu === nsu || t.authCode === authCode);

    this.isTransactionInProgress.set(true);
    this.pinpadState.set('PROCESSING_AUTHORIZER');
    this.pinpadLcdLine1.set('ESTORNO TEF');
    this.pinpadLcdLine2.set('CANCELANDO NSU ' + nsu);

    await this.sleep(1200);

    if (target) {
      target.status = 'REFUNDED';
      target.message = 'TRANSACAO CANCELADA / ESTORNADA';
      this.saveHistory([...list]);
    }

    const cancelSlip = `
========================================
       COMPROVANTE DE CANCELAMENTO
            TEF DEDICADO
========================================
ESTABELECIMENTO: ${this.context.companyName() || '3EATCRU'}
DATA: ${new Date().toLocaleString('pt-BR')}
NSU ORIGINAL: ${nsu}
AUTORIZACAO: ${authCode}
VALOR ESTORNADO: R$ ${amount.toFixed(2)}
STATUS: CANCELAMENTO CONFIRMADO (CNC)
========================================
    VALOR REVERTIDO NA CONTA DO TITULAR
========================================
`;

    this.pinpadState.set('APPROVED');
    this.pinpadLcdLine1.set('CANCELAMENTO OK');
    this.pinpadLcdLine2.set('COMPROVANTE EMITIDO');
    setTimeout(() => this.resetPinpad(), 2500);

    return {
      success: true,
      message: `Estorno TEF processado com sucesso para NSU: ${nsu}`,
      slip: cancelSlip
    };
  }

  /**
   * Generates formatted Brazilian standard 80mm/58mm thermal slip text for TEF
   */
  private generateSlipContent(params: {
    compName: string;
    type: TefPaymentType;
    brand: string;
    amount: number;
    nsu: string;
    authCode: string;
    cardMasked: string;
    copy: 'CLIENTE' | 'ESTABELECIMENTO';
    provider: TefProvider;
  }): string {
    const divider = '----------------------------------------';
    const typeLabel = params.type.replace(/_/g, ' ');
    const dateStr = new Date().toLocaleString('pt-BR');

    return [
      '========================================',
      `       ${params.compName.toUpperCase().substring(0, 32)}`,
      '         COMPROVANTE TEF DEDICADO       ',
      `         VIA DO ${params.copy}         `,
      '========================================',
      `DATA: ${dateStr}`,
      `REDE/PROVEDOR: ${params.provider}`,
      `MODALIDADE: ${typeLabel}`,
      `BANDEIRA: ${params.brand}`,
      `CARTAO: ${params.cardMasked}`,
      divider,
      `VALOR TOTAL:                    R$ ${params.amount.toFixed(2)}`,
      divider,
      `NSU TEF: ${params.nsu}`,
      `COD. AUTORIZACAO: ${params.authCode}`,
      'STATUS: APROVADA COM SENHA',
      divider,
      params.copy === 'ESTABELECIMENTO' 
        ? 'ASSINATURA: ____________________________' 
        : '         OBRIGADO PELA PREFERENCIA      ',
      '========================================',
      '\n\n'
    ].join('\n');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
