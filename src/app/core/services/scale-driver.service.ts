import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ScaleProtocol = 'TOLEDO_PRT1' | 'TOLEDO_PRT3' | 'FILIZOLA_02' | 'URANO_POP' | 'ELGIN_DP' | 'RAMUZA';
export type ScaleConnectionMode = 'simulator' | 'web_serial' | 'websocket_bridge';

export interface ScaleReading {
  raw: string;
  weightGross: number;
  weightTare: number;
  weightNet: number;
  isStable: boolean;
  unitPrice: number;
  totalPrice: number;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class ScaleDriverService {
  private platformId = inject(PLATFORM_ID);

  // Core Reactive Signals
  readonly isConnected = signal<boolean>(false);
  readonly connectionMode = signal<ScaleConnectionMode>('simulator');
  readonly activeProtocol = signal<ScaleProtocol>('TOLEDO_PRT1');
  readonly baudRate = signal<number>(9600);
  readonly serialPortName = signal<string>('COM1 / USB-Serial');

  // Weights & Calculations
  readonly weightGross = signal<number>(1.250);
  readonly weightTare = signal<number>(0);
  readonly isStable = signal<boolean>(true);
  readonly unitPrice = signal<number>(39.90); // R$/kg
  readonly lastRawFrame = signal<string>('02 30 31 32 35 30 03 (STX 01250 ETX)');
  readonly connectionStatusText = signal<string>('Simulador de Balança Ativo');

  // Derived Computed Signals
  readonly weightNet = computed(() => {
    return Math.max(0, parseFloat((this.weightGross() - this.weightTare()).toFixed(3)));
  });

  readonly totalPrice = computed(() => {
    return parseFloat((this.weightNet() * this.unitPrice()).toFixed(2));
  });

  // Native Web Serial Port references (Browser only)
  private serialPort: any = null;
  private serialReader: any = null;
  private bridgeSocket: WebSocket | null = null;
  private oscillationTimer: any = null;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.initSimulatorOscillation();
    }
  }

  /**
   * Initializes subtle realistic weight stabilization jitter when simulating
   */
  private initSimulatorOscillation() {
    if (this.oscillationTimer) clearInterval(this.oscillationTimer);
    
    this.oscillationTimer = setInterval(() => {
      if (this.connectionMode() === 'simulator') {
        // Minor realistic micro-oscillation
        const base = this.weightGross();
        if (base > 0 && Math.random() < 0.15) {
          this.isStable.set(false);
          setTimeout(() => this.isStable.set(true), 400);
        }
      }
    }, 1500);
  }

  /**
   * Adjusts the simulated gross weight manually (e.g. placing an item on the scale)
   */
  setSimulatedWeight(kg: number) {
    const clamped = Math.max(0, Math.min(30.0, parseFloat(kg.toFixed(3))));
    this.weightGross.set(clamped);
    this.isStable.set(false);
    this.updateSimulatedRawFrame(clamped);
    setTimeout(() => this.isStable.set(true), 300);
  }

  /**
   * Sets the unit price per kg (R$/kg)
   */
  setUnitPrice(price: number) {
    this.unitPrice.set(Math.max(0, price));
  }

  /**
   * Tares the scale (stores current gross weight as tare)
   */
  tare() {
    this.weightTare.set(this.weightGross());
    this.isStable.set(false);
    setTimeout(() => this.isStable.set(true), 250);
  }

  /**
   * Zeroes the scale (clears tare and sets gross weight to 0)
   */
  zero() {
    this.weightTare.set(0);
    this.weightGross.set(0);
    this.isStable.set(true);
    this.updateSimulatedRawFrame(0);
  }

  /**
   * Formats a protocol-compliant raw byte string frame based on active protocol
   */
  private updateSimulatedRawFrame(kg: number) {
    const grams = Math.round(kg * 1000);
    const gPadded = grams.toString().padStart(5, '0');
    
    switch (this.activeProtocol()) {
      case 'TOLEDO_PRT1':
      case 'TOLEDO_PRT3':
        this.lastRawFrame.set(`02 ${gPadded.split('').map(c => c.charCodeAt(0).toString(16)).join(' ')} 03 (STX ${gPadded} ETX)`);
        break;
      case 'FILIZOLA_02':
        this.lastRawFrame.set(`02 ${gPadded} 03 [FILIZOLA-02: ${kg.toFixed(3)}kg]`);
        break;
      case 'URANO_POP':
        this.lastRawFrame.set(`[STX]S ${kg.toFixed(3)}kg[ETX] (Estável: SIM)`);
        break;
      case 'ELGIN_DP':
        this.lastRawFrame.set(`02 ${gPadded} 0D 0A [ELGIN: ${kg.toFixed(3)}kg]`);
        break;
      default:
        this.lastRawFrame.set(`RAW:${gPadded}`);
    }
  }

  /**
   * Attempts to connect to a physical scale using the Web Serial API (Chrome/Edge)
   */
  async connectWebSerial(baudRate = 9600): Promise<{ success: boolean; message: string }> {
    if (!isPlatformBrowser(this.platformId)) {
      return { success: false, message: 'Web Serial API indisponível no servidor SSR.' };
    }

    if (!('serial' in navigator)) {
      return { 
        success: false, 
        message: 'Navegador não suporta a Web Serial API. Use o Google Chrome, Microsoft Edge ou o Agente Bridge Local.' 
      };
    }

    try {
      this.serialPort = await (navigator as any).serial.requestPort();
      await this.serialPort.open({ 
        baudRate, 
        dataBits: 8, 
        stopBits: 1, 
        parity: 'none' 
      });

      this.baudRate.set(baudRate);
      this.connectionMode.set('web_serial');
      this.isConnected.set(true);
      this.connectionStatusText.set(`Conectado via Web Serial (${baudRate} bps)`);

      this.startSerialReader();
      return { success: true, message: 'Balança serial conectada com sucesso via Web Serial!' };
    } catch (err: any) {
      console.warn('[Scale WebSerial] Falha ou cancelado pelo usuário:', err);
      return { success: false, message: err?.message || 'Conexão serial cancelada ou porta ocupada.' };
    }
  }

  /**
   * Reads incoming byte stream continuously from Web Serial
   */
  private async startSerialReader() {
    if (!this.serialPort || !this.serialPort.readable) return;

    try {
      const textDecoder = new TextDecoderStream();
      this.serialPort.readable.pipeTo(textDecoder.writable);
      this.serialReader = textDecoder.readable.getReader();

      let buffer = '';
      while (this.isConnected()) {
        const { value, done } = await this.serialReader.read();
        if (done) break;
        if (value) {
          buffer += value;
          // Look for frame delimiters (STX = \x02, ETX = \x03 or \r\n)
          const stxIdx = buffer.lastIndexOf('\x02');
          const etxIdx = buffer.indexOf('\x03', stxIdx);

          if (stxIdx !== -1 && etxIdx !== -1 && etxIdx > stxIdx) {
            const frame = buffer.substring(stxIdx + 1, etxIdx);
            this.parseFrame(frame);
            buffer = buffer.substring(etxIdx + 1);
          } else if (buffer.includes('\n')) {
            const lines = buffer.split('\n');
            const lastLine = lines[lines.length - 2] || '';
            this.parseFrame(lastLine.trim());
            buffer = lines[lines.length - 1];
          }
        }
      }
    } catch (err) {
      console.error('[Scale Stream Error]', err);
    }
  }

  /**
   * Connects to a Local WebSocket Bridge (e.g. ACBrBalanca, 3eatcru-hardware-bridge on port 9091)
   */
  connectWebSocketBridge(url = 'ws://localhost:9091/scale'): Promise<{ success: boolean; message: string }> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.resolve({ success: false, message: 'Indisponível em SSR.' });
    }

    return new Promise((resolve) => {
      try {
        if (this.bridgeSocket) {
          this.bridgeSocket.close();
        }

        this.bridgeSocket = new WebSocket(url);

        this.bridgeSocket.onopen = () => {
          this.connectionMode.set('websocket_bridge');
          this.isConnected.set(true);
          this.connectionStatusText.set(`Conectado ao Agente Local Bridge (${url})`);
          resolve({ success: true, message: 'Conexão estabelecida com o Agente de Balança Local!' });
        };

        this.bridgeSocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (typeof data.weight === 'number') {
              this.weightGross.set(data.weight);
              this.isStable.set(data.isStable !== false);
              this.lastRawFrame.set(data.raw || JSON.stringify(data));
            }
          } catch {
            this.parseFrame(event.data);
          }
        };

        this.bridgeSocket.onerror = () => {
          this.connectionStatusText.set('Falha na ponte WebSocket Local. Alternando para simulador.');
          this.disconnect();
          resolve({ success: false, message: 'Não foi possível conectar ao Agente Bridge Local em ' + url });
        };

        this.bridgeSocket.onclose = () => {
          this.isConnected.set(false);
        };
      } catch (err: any) {
        resolve({ success: false, message: err?.message || 'Erro ao inicializar WebSocket.' });
      }
    });
  }

  /**
   * Disconnects active hardware connection and restores realistic simulator mode
   */
  async disconnect() {
    if (this.serialReader) {
      try { await this.serialReader.cancel(); } catch { /* ignore cancel error */ }
      this.serialReader = null;
    }
    if (this.serialPort) {
      try { await this.serialPort.close(); } catch { /* ignore close error */ }
      this.serialPort = null;
    }
    if (this.bridgeSocket) {
      try { this.bridgeSocket.close(); } catch { /* ignore close error */ }
      this.bridgeSocket = null;
    }

    this.isConnected.set(false);
    this.connectionMode.set('simulator');
    this.connectionStatusText.set('Simulador de Balança Ativo');
  }

  /**
   * Parses frame strings according to Brazilian commercial scale standards (Toledo / Filizola / Urano / Elgin)
   */
  private parseFrame(frame: string) {
    this.lastRawFrame.set(frame);

    // Extract digits only (weight in grams)
    const digitsOnly = frame.replace(/[^0-9]/g, '');
    if (digitsOnly.length >= 4) {
      const parsedGrams = parseInt(digitsOnly.substring(0, 5), 10);
      if (!isNaN(parsedGrams)) {
        const kg = parsedGrams / 1000;
        this.weightGross.set(kg);
        this.isStable.set(!frame.toLowerCase().includes('u') && !frame.toLowerCase().includes('inst'));
      }
    }
  }

  /**
   * Captures the instant weight directly for integration with PDV checkout
   */
  async captureWeight(): Promise<{ netWeight: number; isStable: boolean; unitPrice: number; totalPrice: number }> {
    return {
      netWeight: this.weightNet(),
      isStable: this.isStable(),
      unitPrice: this.unitPrice(),
      totalPrice: this.totalPrice()
    };
  }

  /**
   * Generates a 13-digit scale barcode (EAN-13 Padrão Balança: Prefixo 2 + 5 dígitos item + 5 dígitos peso/preço + DV)
   */
  generateScaleBarcode(itemCode: string, valueOrWeight: number, type: 'PESO' | 'PRECO' = 'PESO'): string {
    const prefix = '2'; // Padrão Brasil de etiquetas geradas em balança
    const code5 = (itemCode.replace(/[^0-9]/g, '') || '101').padStart(5, '0').substring(0, 5);
    
    let val5 = '';
    if (type === 'PESO') {
      val5 = Math.round(valueOrWeight * 1000).toString().padStart(5, '0').substring(0, 5);
    } else {
      val5 = Math.round(valueOrWeight * 100).toString().padStart(5, '0').substring(0, 5);
    }

    const payload12 = `${prefix}${code5}${val5}`;
    
    // EAN-13 Check Digit Calculation (Modulo 10)
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(payload12[i], 10);
      sum += i % 2 === 0 ? digit * 1 : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;

    return `${payload12}${checkDigit}`;
  }
}
