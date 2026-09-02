import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { db } from '../../core/storage/dexie.db';
import { HardwareDevice } from '../../core/models';
import { EscPosService } from '../../core/services/escpos.service';
import { ScaleDriverService, ScaleProtocol } from '../../core/services/scale-driver.service';
import { TefDriverService, TefPaymentType, TefProvider } from '../../core/services/tef-driver.service';
import { AppContextService } from '../../core/services/app-context.service';
import { TransactionEngine } from '../../core/workflow/transaction.engine';
import { IdGeneratorService } from '../../core/services/id-generator.service';

@Component({
  selector: 'app-hardware',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col bg-zinc-50 text-zinc-800 p-4 lg:p-6 space-y-4 overflow-hidden select-none font-sans">
      
      <!-- Top Header Navigation -->
      <div class="flex flex-wrap items-center justify-between pb-3 border-b border-zinc-200 shrink-0 gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-bold shadow-xs">
            <mat-icon>devices</mat-icon>
          </div>
          <div>
            <h2 class="text-base font-bold text-zinc-900 leading-tight">Central de Hardware & Periféricos</h2>
            <p class="text-xs text-zinc-500">Drivers para Balanças Seriais, TEF Dedicado / Pinpad e Impressoras ESC/POS</p>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="flex flex-wrap gap-1.5 bg-zinc-100 p-1 rounded-xl border border-zinc-200">
          <button (click)="activeTab.set('scale')" 
                  [class.bg-white]="activeTab() === 'scale'" 
                  [class.text-zinc-900]="activeTab() === 'scale'"
                  [class.shadow-xs]="activeTab() === 'scale'"
                  class="px-3.5 py-1.5 rounded-lg text-xs font-bold text-zinc-600 cursor-pointer flex items-center gap-1.5 transition">
            <mat-icon class="text-xs text-amber-600">scale</mat-icon> Balança Serial
          </button>

          <button (click)="activeTab.set('tef')" 
                  [class.bg-white]="activeTab() === 'tef'" 
                  [class.text-zinc-900]="activeTab() === 'tef'"
                  [class.shadow-xs]="activeTab() === 'tef'"
                  class="px-3.5 py-1.5 rounded-lg text-xs font-bold text-zinc-600 cursor-pointer flex items-center gap-1.5 transition">
            <mat-icon class="text-xs text-indigo-600">credit_card</mat-icon> TEF & Pinpad
          </button>

          <button (click)="activeTab.set('printer')" 
                  [class.bg-white]="activeTab() === 'printer'" 
                  [class.text-zinc-900]="activeTab() === 'printer'"
                  [class.shadow-xs]="activeTab() === 'printer'"
                  class="px-3.5 py-1.5 rounded-lg text-xs font-bold text-zinc-600 cursor-pointer flex items-center gap-1.5 transition">
            <mat-icon class="text-xs text-purple-600">print</mat-icon> Impressoras & Gaveta
          </button>

          <button (click)="activeTab.set('devices')" 
                  [class.bg-white]="activeTab() === 'devices'" 
                  [class.text-zinc-900]="activeTab() === 'devices'"
                  [class.shadow-xs]="activeTab() === 'devices'"
                  class="px-3.5 py-1.5 rounded-lg text-xs font-bold text-zinc-600 cursor-pointer flex items-center gap-1.5 transition">
            <mat-icon class="text-xs text-cyan-600">settings_input_component</mat-icon> Dispositivos ({{ devices().length }})
          </button>
        </div>
      </div>

      <!-- TAB 1: BALANÇA SERIAL DE CHECKOUT -->
      @if (activeTab() === 'scale') {
        <div class="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 overflow-y-auto pr-1">
          
          <!-- Left: Scale Controls & LCD Display (7 cols) -->
          <div class="lg:col-span-7 space-y-4">
            
            <!-- Scale Terminal Card -->
            <div class="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div class="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                    <mat-icon class="text-sm">scale</mat-icon>
                  </div>
                  <div>
                    <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-900">Balança Serial (Toledo / Filizola / Urano / Elgin)</h3>
                    <p class="text-[11px] text-zinc-500">{{ scale.connectionStatusText() }}</p>
                  </div>
                </div>

                <!-- Status Badge -->
                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1"
                      [class.bg-emerald-50]="scale.isStable()"
                      [class.text-emerald-700]="scale.isStable()"
                      [class.border]="true"
                      [class.border-emerald-200]="scale.isStable()"
                      [class.bg-amber-50]="!scale.isStable()"
                      [class.text-amber-700]="!scale.isStable()"
                      [class.border-amber-200]="!scale.isStable()"
                      [class.animate-pulse]="!scale.isStable()">
                  <span class="w-1.5 h-1.5 rounded-full" [class.bg-emerald-600]="scale.isStable()" [class.bg-amber-500]="!scale.isStable()"></span>
                  {{ scale.isStable() ? 'PESO ESTÁVEL' : 'OSCILANDO...' }}
                </span>
              </div>

              <!-- Main Scale LCD Screen -->
              <div class="bg-zinc-950 p-5 rounded-2xl border-2 border-zinc-800 text-white flex flex-col justify-between space-y-4 shadow-inner">
                <div class="grid grid-cols-3 gap-2 text-center border-b border-zinc-800 pb-3">
                  <div class="text-left">
                    <span class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Peso Bruto</span>
                    <div class="text-lg font-mono font-bold text-zinc-300">{{ scale.weightGross() | number:'1.3-3' }} kg</div>
                  </div>
                  <div class="text-center">
                    <span class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tara</span>
                    <div class="text-lg font-mono font-bold text-zinc-400">{{ scale.weightTare() | number:'1.3-3' }} kg</div>
                  </div>
                  <div class="text-right">
                    <span class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Preço / kg</span>
                    <div class="text-lg font-mono font-bold text-amber-400">R$ {{ scale.unitPrice() | number:'1.2-2' }}</div>
                  </div>
                </div>

                <!-- Big Net Weight Display -->
                <div class="flex items-center justify-between">
                  <div>
                    <span class="text-[11px] font-black text-amber-400 uppercase tracking-widest">PESO LÍQUIDO</span>
                    <div class="text-4xl lg:text-5xl font-black font-mono tracking-tight text-emerald-400">
                      {{ scale.weightNet() | number:'1.3-3' }} <span class="text-2xl font-normal text-emerald-500/80">kg</span>
                    </div>
                  </div>
                  <div class="text-right">
                    <span class="text-[11px] font-black text-zinc-400 uppercase tracking-widest">TOTAL CALCULADO</span>
                    <div class="text-3xl lg:text-4xl font-black font-mono text-white">
                      R$ {{ scale.totalPrice() | number:'1.2-2' }}
                    </div>
                  </div>
                </div>

                <!-- Raw Serial Frame Inspector -->
                <div class="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                  <span>FRAME SERIAL: <span class="text-amber-400 font-bold">{{ scale.lastRawFrame() }}</span></span>
                  <span>PROTOCOLO: {{ scale.activeProtocol() }}</span>
                </div>
              </div>

              <!-- Scale Interaction Actions -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <button (click)="scale.tare()" class="py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition">
                  <mat-icon class="text-xs">sync_alt</mat-icon> Tara
                </button>
                <button (click)="scale.zero()" class="py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition">
                  <mat-icon class="text-xs">restart_alt</mat-icon> Zero
                </button>
                <button (click)="printScaleLabel()" class="py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition">
                  <mat-icon class="text-xs">label</mat-icon> Etiqueta EAN-13
                </button>
                <button (click)="connectSerial()" class="py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition">
                  <mat-icon class="text-xs">usb</mat-icon> Web Serial API
                </button>
              </div>

              <!-- Simulation Weight Slider & Config -->
              <div class="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-bold text-zinc-700">Simulador de Peso no Prato da Balança:</span>
                  <strong class="font-mono text-zinc-900 bg-white px-2.5 py-1 rounded-lg border border-zinc-200">{{ simWeight() }} kg</strong>
                </div>
                <input type="range" min="0" max="15" step="0.05" [value]="simWeight()" (input)="onSimWeightInput($any($event.target).value)" class="w-full accent-amber-600 cursor-pointer" />
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label class="block text-[11px] font-bold text-zinc-600 mb-1">Preço Unitário do Item (R$/kg):</label>
                    <input type="number" step="0.50" [value]="simUnitPrice()" (input)="onSimUnitPriceInput($any($event.target).value)" class="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-bold font-mono focus:ring-2 focus:ring-amber-500 outline-none" />
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold text-zinc-600 mb-1">Protocolo de Comunicação:</label>
                    <select [value]="selectedScaleProtocol()" (change)="onProtocolSelect($any($event.target).value)" class="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none">
                      <option value="TOLEDO_PRT1">Toledo Prix 3 / 4 (Protocolo Prt 1)</option>
                      <option value="TOLEDO_PRT3">Toledo Prix 3 Plus / Fit (Protocolo Prt 3)</option>
                      <option value="FILIZOLA_02">Filizola Platina / BP15 (Protocolo 02)</option>
                      <option value="URANO_POP">Urano POP-Z / US 20/2</option>
                      <option value="ELGIN_DP">Elgin DP-30 / DP-15</option>
                      <option value="RAMUZA">Ramuza DCR / DP</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <!-- WebSocket Local Bridge Helper -->
            <div class="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3">
              <div>
                <h4 class="text-xs font-bold text-zinc-900">Agente Bridge Local (WebSocket ws://localhost:9091/scale)</h4>
                <p class="text-[11px] text-zinc-500">Para sistemas legados com porta serial exclusiva ou automação ACBr</p>
              </div>
              <button (click)="connectBridge()" class="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl cursor-pointer whitespace-nowrap">
                Testar Bridge Local
              </button>
            </div>
          </div>

          <!-- Right: Generated Scale Label Preview (5 cols) -->
          <div class="lg:col-span-5 bg-amber-50/70 border border-amber-200 rounded-3xl p-5 shadow-xs flex flex-col min-h-[420px]">
            <div class="flex items-center justify-between pb-3 border-b border-amber-200/80 mb-3">
              <span class="text-xs font-black uppercase text-amber-900 flex items-center gap-1.5">
                <mat-icon class="text-sm">label</mat-icon> Etiqueta de Gôndola / Balança (60x40mm)
              </span>
              <button (click)="printScaleLabel()" class="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer">
                Imprimir
              </button>
            </div>

            <!-- Label Card -->
            <div class="flex-1 bg-white p-5 rounded-2xl border border-amber-200/80 font-mono text-xs text-zinc-900 shadow-sm flex flex-col justify-between space-y-3 select-all">
              <div class="text-center pb-2 border-b border-dashed border-zinc-300">
                <div class="font-black text-sm text-zinc-900 uppercase">{{ context.companyName() || '3EATCRU EXPRESS' }}</div>
                <div class="text-[10px] text-zinc-500">HORTIFRUTI & PESÁVEIS</div>
              </div>

              <div class="space-y-1">
                <div class="text-sm font-black text-zinc-900 uppercase">MACA FUJI NACIONAL SELECIONADA</div>
                <div class="text-[10px] text-zinc-500 flex justify-between">
                  <span>EMB: {{ todayDateStr }}</span>
                  <span>VAL: {{ validDateStr }}</span>
                </div>
              </div>

              <div class="bg-zinc-50 p-3 rounded-xl border border-zinc-200 space-y-1">
                <div class="flex justify-between text-xs font-bold text-zinc-700">
                  <span>PESO LÍQUIDO:</span>
                  <span class="text-zinc-900">{{ scale.weightNet() | number:'1.3-3' }} kg</span>
                </div>
                <div class="flex justify-between text-xs font-bold text-zinc-700">
                  <span>PREÇO / KG:</span>
                  <span class="text-zinc-900">R$ {{ scale.unitPrice() | number:'1.2-2' }}</span>
                </div>
                <div class="flex justify-between text-sm font-black text-emerald-700 pt-1 border-t border-zinc-200">
                  <span>TOTAL:</span>
                  <span>R$ {{ scale.totalPrice() | number:'1.2-2' }}</span>
                </div>
              </div>

              <!-- Barcode Display -->
              <div class="text-center pt-2 border-t border-dashed border-zinc-300 space-y-1">
                <div class="tracking-widest font-black text-base scale-y-125 text-zinc-900">
                  ||| | | |||| || | || |||| |
                </div>
                <div class="text-xs font-mono font-bold text-zinc-700">{{ currentBarcode() }}</div>
                <div class="text-[9px] text-zinc-400">Padrão EAN-13 Balança (2 + Código + Peso + DV)</div>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- TAB 2: TEF DEDICADO & PINPAD -->
      @if (activeTab() === 'tef') {
        <div class="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 overflow-y-auto pr-1">
          
          <!-- Left: Pinpad Hardware Emulator & Payment Test (7 cols) -->
          <div class="lg:col-span-7 space-y-4">
            
            <!-- Pinpad Hardware Device Mockup -->
            <div class="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div class="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                    <mat-icon class="text-sm">credit_card</mat-icon>
                  </div>
                  <div>
                    <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-900">Pinpad TEF Dedicado (SiTEF / PayGo / Stone / Cielo)</h3>
                    <p class="text-[11px] text-zinc-500">Modelo: {{ tef.pinpadModel() }} | Provedor: {{ tef.provider() }}</p>
                  </div>
                </div>

                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                  PINPAD PRONTO
                </span>
              </div>

              <!-- Pinpad Body Frame -->
              <div class="bg-zinc-900 p-6 rounded-3xl border-4 border-zinc-800 shadow-xl max-w-sm mx-auto flex flex-col items-center space-y-4 text-white">
                
                <!-- Pinpad Top Header -->
                <div class="w-full flex items-center justify-between text-[10px] font-mono text-zinc-400 pb-1 border-b border-zinc-800">
                  <span class="flex items-center gap-1 font-bold text-indigo-400">
                    <mat-icon class="text-[10px]">contactless</mat-icon> APROXIME / CHIP
                  </span>
                  <span>ID: {{ tef.terminalId() }}</span>
                </div>

                <!-- Pinpad 2x16 LCD Backlit Display -->
                <div class="w-full bg-emerald-950 p-4 rounded-xl border-2 border-emerald-800/80 font-mono text-center shadow-inner space-y-1">
                  <div class="text-xs font-bold text-emerald-400 tracking-wider uppercase h-5 flex items-center justify-center">
                    {{ tef.pinpadLcdLine1() }}
                  </div>
                  <div class="text-sm font-black text-emerald-300 tracking-widest uppercase h-6 flex items-center justify-center">
                    {{ tef.pinpadLcdLine2() }}
                  </div>
                </div>

                <!-- Chip Slot & Contactless Indicator -->
                <div class="w-full py-2 bg-zinc-800/70 rounded-xl border border-zinc-700 flex items-center justify-center gap-2 text-xs font-bold text-zinc-300">
                  <mat-icon class="text-amber-400 animate-bounce">payment</mat-icon>
                  <span>SLOT DE CHIP EMV / NFC CONTACTLESS</span>
                </div>

                <!-- Pinpad Physical Numeric Keypad -->
                <div class="w-full grid grid-cols-3 gap-2 pt-2">
                  <div class="p-2 bg-zinc-800 rounded-lg text-center font-mono font-bold text-sm text-zinc-200 border border-zinc-700">1</div>
                  <div class="p-2 bg-zinc-800 rounded-lg text-center font-mono font-bold text-sm text-zinc-200 border border-zinc-700">2</div>
                  <div class="p-2 bg-zinc-800 rounded-lg text-center font-mono font-bold text-sm text-zinc-200 border border-zinc-700">3</div>
                  <div class="p-2 bg-zinc-800 rounded-lg text-center font-mono font-bold text-sm text-zinc-200 border border-zinc-700">4</div>
                  <div class="p-2 bg-zinc-800 rounded-lg text-center font-mono font-bold text-sm text-zinc-200 border border-zinc-700">5</div>
                  <div class="p-2 bg-zinc-800 rounded-lg text-center font-mono font-bold text-sm text-zinc-200 border border-zinc-700">6</div>
                  <div class="p-2 bg-zinc-800 rounded-lg text-center font-mono font-bold text-sm text-zinc-200 border border-zinc-700">7</div>
                  <div class="p-2 bg-zinc-800 rounded-lg text-center font-mono font-bold text-sm text-zinc-200 border border-zinc-700">8</div>
                  <div class="p-2 bg-zinc-800 rounded-lg text-center font-mono font-bold text-sm text-zinc-200 border border-zinc-700">9</div>
                  <div class="p-2 bg-rose-900/80 text-rose-300 rounded-lg text-center font-bold text-xs flex items-center justify-center border border-rose-800">ANULA</div>
                  <div class="p-2 bg-zinc-800 rounded-lg text-center font-mono font-bold text-sm text-zinc-200 border border-zinc-700">0</div>
                  <div class="p-2 bg-emerald-800/80 text-emerald-300 rounded-lg text-center font-bold text-xs flex items-center justify-center border border-emerald-700">ENTRA</div>
                </div>
              </div>

              <!-- TEF Test Launcher -->
              <div class="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
                <div class="flex items-center justify-between">
                  <h4 class="text-xs font-bold text-zinc-800 uppercase">Simular Transação no Pinpad TEF:</h4>
                  <div class="flex items-center gap-2">
                    <label class="text-[11px] font-bold text-zinc-500">Provedor:</label>
                    <select [value]="selectedTefProvider()" (change)="selectedTefProvider.set($any($event.target).value)" class="px-2 py-1 bg-white border border-zinc-200 rounded-lg text-xs font-bold outline-none">
                      <option value="SITEF">SiTEF (Fiserv / Software Express)</option>
                      <option value="PAYGO">PayGo Web / CWI</option>
                      <option value="STONE_TEF">Stone TEF Integrado</option>
                      <option value="CIELO_TEF">Cielo Dedicado LIO</option>
                    </select>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[11px] font-bold text-zinc-600 mb-1">Valor da Operação (R$):</label>
                    <input type="number" step="1.00" [value]="tefTestAmount()" (input)="tefTestAmount.set(+$any($event.target).value)" class="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-bold font-mono focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold text-zinc-600 mb-1">Tipo de Pagamento:</label>
                    <select [value]="selectedTefType()" (change)="selectedTefType.set($any($event.target).value)" class="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                      <option value="DEBITO">Cartão de Débito</option>
                      <option value="CREDITO_A_VISTA">Cartão de Crédito à Vista</option>
                      <option value="CREDITO_PARCELADO">Crédito Parcelado (3x)</option>
                      <option value="VOUCHER">Vale Refeição / Alimentação</option>
                      <option value="PIX_PINPAD">Pix Dinâmico no Pinpad</option>
                    </select>
                  </div>
                </div>

                <div class="flex gap-2 pt-1">
                  <button (click)="executeTefTest()" [disabled]="tef.isTransactionInProgress()" class="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer flex items-center justify-center gap-2 transition">
                    <mat-icon class="text-sm">play_arrow</mat-icon>
                    Iniciar Cobrança no Pinpad
                  </button>
                  <button (click)="tef.resetPinpad()" class="px-4 py-3 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-bold rounded-xl text-xs cursor-pointer">
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: TEF Slips & Transactions History (5 cols) -->
          <div class="lg:col-span-5 space-y-4">
            
            <!-- Dual Slip Printer Preview (Via Cliente & Via Estabelecimento) -->
            <div class="bg-indigo-50/70 border border-indigo-200 rounded-3xl p-5 shadow-xs flex flex-col min-h-[380px]">
              <div class="flex items-center justify-between pb-3 border-b border-indigo-200/80 mb-3">
                <span class="text-xs font-black uppercase text-indigo-950 flex items-center gap-1.5">
                  <mat-icon class="text-sm">receipt_long</mat-icon> Comprovante TEF (2 Vias Térmicas)
                </span>
                @if (tef.activeTransaction()) {
                  <button (click)="printTefSlips()" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer">
                    Imprimir Vias
                  </button>
                }
              </div>

              @if (tef.activeTransaction()) {
                <div class="flex-1 bg-white p-4 rounded-2xl border border-indigo-200/80 font-mono text-[11px] leading-tight text-zinc-900 shadow-sm overflow-y-auto space-y-2 select-all">
                  <div class="text-center font-bold">
                    <div>{{ context.companyName() || '3EATCRU STORE' }}</div>
                    <div class="text-[9px] text-zinc-500">COMPROVANTE TEF DEDICADO</div>
                    <div class="text-indigo-600 font-bold text-xs mt-1">*** VIA DO CLIENTE ***</div>
                  </div>
                  <div class="border-b border-dashed border-zinc-300 my-1"></div>
                  <div class="flex justify-between">
                    <span>MODALIDADE:</span>
                    <span class="font-bold">{{ tef.activeTransaction()!.paymentType }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span>BANDEIRA:</span>
                    <span class="font-bold">{{ tef.activeTransaction()!.brand }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span>CARTÃO:</span>
                    <span>{{ tef.activeTransaction()!.cardMasked }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span>NSU:</span>
                    <span class="font-bold">{{ tef.activeTransaction()!.nsu }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span>AUTORIZAÇÃO:</span>
                    <span class="font-bold">{{ tef.activeTransaction()!.authCode }}</span>
                  </div>
                  <div class="border-b border-dashed border-zinc-300 my-1"></div>
                  <div class="flex justify-between font-black text-xs text-emerald-700">
                    <span>VALOR TOTAL:</span>
                    <span>R$ {{ tef.activeTransaction()!.amount.toFixed(2) }}</span>
                  </div>
                  <div class="border-b border-dashed border-zinc-300 my-1"></div>
                  <div class="text-center text-[9px] text-zinc-500 pt-1">
                    STATUS: APROVADA COM SENHA ELETRÔNICA
                  </div>
                </div>
              } @else {
                <div class="flex-1 flex flex-col items-center justify-center text-center p-6 text-indigo-400">
                  <mat-icon class="text-4xl mb-2 opacity-40">credit_card</mat-icon>
                  <p class="text-xs font-bold">Nenhuma transação TEF recente</p>
                  <p class="text-[11px] text-indigo-600/80">Inicie uma cobrança no simulador acima</p>
                </div>
              }
            </div>

            <!-- Recent TEF History List with Refund/Cancel Action -->
            <div class="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs space-y-3">
              <h4 class="text-xs font-bold text-zinc-900 uppercase">Histórico Recente de TEF (Estornos & NSU)</h4>
              
              <div class="space-y-2 max-h-48 overflow-y-auto">
                @for (tx of tef.transactionsHistory(); track tx.id) {
                  <div class="p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div class="font-bold text-zinc-800 flex items-center gap-1.5">
                        <span>{{ tx.brand }} {{ tx.paymentType }}</span>
                        <span class="text-[10px] font-mono font-normal text-zinc-500">NSU: {{ tx.nsu }}</span>
                      </div>
                      <div class="text-[10px] text-zinc-500">
                        {{ tx.timestamp | date:'short' }} • R$ {{ tx.amount.toFixed(2) }}
                      </div>
                    </div>

                    <div class="flex items-center gap-1.5">
                      @if (tx.status === 'APPROVED') {
                        <button (click)="refundTransaction(tx)" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold cursor-pointer">
                          Estorno
                        </button>
                      } @else {
                        <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-zinc-200 text-zinc-600">
                          {{ tx.status }}
                        </span>
                      }
                    </div>
                  </div>
                } @empty {
                  <div class="text-center py-4 text-xs text-zinc-400">
                    Histórico vazio.
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }

      <!-- TAB 3: IMPRESSORAS ESC/POS & GAVETA -->
      @if (activeTab() === 'printer') {
        <div class="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 overflow-y-auto pr-1">
          
          <!-- Left: Controls & Drawer (7 cols) -->
          <div class="lg:col-span-7 space-y-4">
            
            <!-- Cash Drawer & Display Card -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <!-- Cash Drawer -->
              <div class="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-3">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                    <mat-icon class="text-sm">point_of_sale</mat-icon>
                  </div>
                  <div>
                    <h3 class="text-xs font-bold uppercase text-zinc-900">Gaveta de Dinheiro RJ-11</h3>
                    <p class="text-[10px] text-zinc-500">Pulso ESC/POS (27, 112, 0, 25, 250)</p>
                  </div>
                </div>

                <div class="p-4 rounded-xl border text-center transition-all"
                     [class.bg-emerald-50]="isDrawerOpen()"
                     [class.border-emerald-300]="isDrawerOpen()"
                     [class.text-emerald-800]="isDrawerOpen()"
                     [class.scale-102]="isDrawerOpen()"
                     [class.bg-zinc-50]="!isDrawerOpen()"
                     [class.border-zinc-200]="!isDrawerOpen()"
                     [class.text-zinc-500]="!isDrawerOpen()">
                  <mat-icon class="text-3xl mb-1">{{ isDrawerOpen() ? 'lock_open' : 'lock' }}</mat-icon>
                  <div class="text-xs font-bold uppercase">
                    {{ isDrawerOpen() ? 'GAVETA ABERTA (CONTATO ABERTO)' : 'GAVETA TRANCADA (CONTATO FECHADO)' }}
                  </div>
                </div>

                <button (click)="openDrawer()" class="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer flex items-center justify-center gap-1.5 transition">
                  <mat-icon class="text-sm">bolt</mat-icon> Disparar Pulso Elétrico de Abertura
                </button>
              </div>

              <!-- Customer Display VFD -->
              <div class="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-3">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                    <mat-icon class="text-sm">desktop_windows</mat-icon>
                  </div>
                  <div>
                    <h3 class="text-xs font-bold uppercase text-zinc-900">Display de Cliente (VFD 2x20)</h3>
                    <p class="text-[10px] text-zinc-500">Comunicação Serial / USB</p>
                  </div>
                </div>

                <div class="p-4 bg-zinc-950 rounded-xl font-mono text-emerald-400 text-center border-2 border-zinc-800 shadow-inner space-y-1">
                  <div class="text-xs font-bold">{{ vfdLine1 }}</div>
                  <div class="text-xs text-zinc-400">{{ vfdLine2 }}</div>
                </div>

                <button (click)="testDisplay()" class="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1.5 transition">
                  <mat-icon class="text-sm">send</mat-icon> Enviar Mensagem de Boas-Vindas
                </button>
              </div>
            </div>

            <!-- Printer Hardware Test Generator -->
            <div class="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-3">
              <h4 class="text-xs font-bold text-zinc-900 uppercase">Gerador de Comandos ESC/POS</h4>
              <p class="text-xs text-zinc-500">Emita comprovantes de teste para validar guilhotina, alinhamento e caracteres acentuados.</p>
              
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <button (click)="printSaleTest()" class="py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5">
                  <mat-icon class="text-xs text-indigo-600">receipt</mat-icon> Cupom de Venda
                </button>
                <button (click)="printCloseTest()" class="py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5">
                  <mat-icon class="text-xs text-purple-600">summarize</mat-icon> Redução Z / Caixa
                </button>
                <button (click)="printScaleLabel()" class="py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5">
                  <mat-icon class="text-xs text-amber-600">label</mat-icon> Etiqueta de Balança
                </button>
              </div>
            </div>
          </div>

          <!-- Right: 80mm Virtual Paper Tape (5 cols) -->
          <div class="lg:col-span-5 bg-zinc-100 border border-zinc-200 rounded-3xl p-5 shadow-xs flex flex-col min-h-[440px]">
            <div class="flex items-center justify-between pb-3 border-b border-zinc-200 mb-3">
              <span class="text-xs font-black uppercase text-zinc-800 flex items-center gap-1.5">
                <mat-icon class="text-sm">receipt</mat-icon> Bobina Térmica Virtual (80mm)
              </span>
              <button (click)="printCurrentTape()" class="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold cursor-pointer">
                Imprimir
              </button>
            </div>

            <!-- Virtual Thermal Paper Sheet -->
            <div class="flex-1 bg-white p-5 rounded-2xl border border-zinc-200/80 font-mono text-[11px] leading-relaxed text-zinc-900 overflow-y-auto space-y-1 shadow-inner select-all">
              <div class="text-center font-bold">
                <div>{{ context.companyName() || '3EATCRU GOURMET & VAREJO' }}</div>
                <div class="text-[9px] text-zinc-500">CNPJ: 12.345.678/0001-90</div>
                <div class="border-b border-dashed border-zinc-400 my-1.5"></div>
                <div>DOCUMENTO AUXILIAR DE VENDA</div>
                <div class="text-[9px] text-zinc-500">{{ todayStr }}</div>
              </div>
              <div class="border-b border-dashed border-zinc-400 my-1.5"></div>
              <div class="flex justify-between">
                <span>01 X-Burger Artesanal Bacon</span>
                <span>R$ 34,90</span>
              </div>
              <div class="flex justify-between">
                <span>02 Refrigerante Lata 350ml</span>
                <span>R$ 14,00</span>
              </div>
              <div class="flex justify-between">
                <span>1.250kg Maçã Fuji (Balança)</span>
                <span>R$ 49,88</span>
              </div>
              <div class="border-b border-dashed border-zinc-400 my-1.5"></div>
              <div class="flex justify-between font-bold text-xs">
                <span>TOTAL A PAGAR:</span>
                <span>R$ 98,78</span>
              </div>
              <div class="flex justify-between text-[10px] text-zinc-600">
                <span>FORMA: TEF DÉBITO (VISA)</span>
                <span>R$ 98,78</span>
              </div>
              <div class="border-b border-dashed border-zinc-400 my-1.5"></div>
              <div class="text-center text-[9px] text-zinc-500 pt-2">
                SISTEMA: 3EATCRU OS VAREJO 1.0.2
              </div>
            </div>
          </div>
        </div>
      }

      <!-- TAB 4: CADASTRO DE DISPOSITIVOS -->
      @if (activeTab() === 'devices') {
        <div class="flex-1 flex flex-col space-y-4 min-h-0 overflow-y-auto pr-1">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-700">Periféricos Configurados no Terminal</h3>
            <button (click)="openNewDeviceModal()" class="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-xs">
              <mat-icon class="text-sm">add</mat-icon> Adicionar Dispositivo
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            @for (d of devices(); track d.id) {
              <div class="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col justify-between shadow-xs space-y-3">
                <div class="space-y-2">
                  <div class="flex items-start justify-between">
                    <div class="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-800 flex items-center justify-center font-bold">
                      <mat-icon>{{ getIcon(d.category) }}</mat-icon>
                    </div>
                    <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800">
                      {{ d.status }}
                    </span>
                  </div>
                  <h4 class="font-bold text-sm text-zinc-900 leading-snug">{{ d.name }}</h4>
                  <div class="text-[10px] text-zinc-500 font-mono uppercase">
                    {{ d.category }} • {{ d.connectionType }} {{ d.baudRate ? '(' + d.baudRate + ' bps)' : '' }}
                  </div>
                </div>

                <div class="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
                  <span class="text-[10px] text-zinc-400 font-bold uppercase">{{ d.isDefault ? 'Principal' : 'Secundário' }}</span>
                  <div class="flex gap-1">
                    <button (click)="testDevice(d)" class="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg font-bold text-xs cursor-pointer">
                      Testar
                    </button>
                    <button (click)="removeDevice(d)" class="p-1 text-zinc-400 hover:text-rose-600 rounded-lg cursor-pointer">
                      <mat-icon class="text-xs">delete</mat-icon>
                    </button>
                  </div>
                </div>
              </div>
            } @empty {
              <div class="col-span-full py-12 text-center text-zinc-400 text-xs">
                Nenhum dispositivo cadastrado. Clique no botão acima para adicionar.
              </div>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class HardwareComponent implements OnInit {
  public scale = inject(ScaleDriverService);
  public tef = inject(TefDriverService);
  public printer = inject(EscPosService);
  public context = inject(AppContextService);
  private engine = inject(TransactionEngine);
  private idGen = inject(IdGeneratorService);
  private platformId = inject(PLATFORM_ID);

  devices = signal<HardwareDevice[]>([]);
  activeTab = signal<'scale' | 'tef' | 'printer' | 'devices'>('scale');

  // Scale simulation signals
  simWeight = signal(1.250);
  simUnitPrice = signal(39.90);
  selectedScaleProtocol = signal<ScaleProtocol>('TOLEDO_PRT1');

  // TEF Test state
  tefTestAmount = signal(45.00);
  selectedTefType = signal<TefPaymentType>('DEBITO');
  selectedTefProvider = signal<TefProvider>('SITEF');

  // Cash Drawer and VFD
  isDrawerOpen = signal(false);
  vfdLine1 = '3EATCRU OS - POS';
  vfdLine2 = 'TOTAL: R$ 98,78';

  // Date strings
  todayStr = new Date().toLocaleString('pt-BR');
  todayDateStr = new Date().toLocaleDateString('pt-BR');
  validDateStr = new Date(Date.now() + 5 * 86400000).toLocaleDateString('pt-BR');

  currentBarcode = computed(() => {
    return this.scale.generateScaleBarcode('101', this.scale.weightNet(), 'PESO');
  });

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      await this.loadDevices();
    }
  }

  async loadDevices() {
    if (!isPlatformBrowser(this.platformId)) return;
    const currentCompanyId = this.context.companyId();
    const list = await db.hardwareDevices.where('companyId').equals(currentCompanyId).toArray();
    this.devices.set(list);
  }

  onSimWeightInput(val: string) {
    const num = parseFloat(val) || 0;
    this.simWeight.set(num);
    this.scale.setSimulatedWeight(num);
  }

  onSimUnitPriceInput(val: string) {
    const num = parseFloat(val) || 0;
    this.simUnitPrice.set(num);
    this.scale.setUnitPrice(num);
  }

  onProtocolSelect(proto: ScaleProtocol) {
    this.selectedScaleProtocol.set(proto);
    this.scale.activeProtocol.set(proto);
    this.scale.setSimulatedWeight(this.simWeight());
  }

  async connectSerial() {
    const res = await this.scale.connectWebSerial(9600);
    if (!res.success) {
      console.warn('[HardwareComponent]', res.message);
    }
  }

  async connectBridge() {
    const res = await this.scale.connectWebSocketBridge('ws://localhost:9091/scale');
    console.log('[HardwareComponent]', res.message);
  }

  printScaleLabel() {
    const labelText = this.printer.generateScaleLabel({
      companyName: this.context.companyName() || '3EATCRU EXPRESS',
      productName: 'Maca Fuji Nacional Selecionada',
      weight: this.scale.weightNet(),
      unitPrice: this.scale.unitPrice(),
      totalPrice: this.scale.totalPrice(),
      barcode: this.currentBarcode()
    });
    this.printer.printReceipt(labelText);
  }

  async executeTefTest() {
    this.tef.provider.set(this.selectedTefProvider());
    const res = await this.tef.processTefPayment({
      amount: this.tefTestAmount(),
      paymentType: this.selectedTefType(),
      installments: this.selectedTefType() === 'CREDITO_PARCELADO' ? 3 : 1
    });

    if (res.success && res.transaction) {
      // Auto print customer slip
      this.printer.printReceipt(res.transaction.customerSlip);
    }
  }

  printTefSlips() {
    const tx = this.tef.activeTransaction();
    if (tx) {
      this.printer.printReceipt(tx.customerSlip + '\n\n' + tx.merchantSlip);
    }
  }

  async refundTransaction(tx: any) {
    const res = await this.tef.cancelTefTransaction(tx.nsu, tx.authCode, tx.amount);
    if (res.slip) {
      this.printer.printReceipt(res.slip);
    }
  }

  openDrawer() {
    this.isDrawerOpen.set(true);
    setTimeout(() => this.isDrawerOpen.set(false), 2500);
  }

  testDisplay() {
    this.vfdLine1 = 'BEM-VINDO AO 3EATCRU!';
    this.vfdLine2 = 'CAIXA LIVRE';
    setTimeout(() => {
      this.vfdLine1 = '3EATCRU OS - POS';
      this.vfdLine2 = 'TOTAL: R$ 98,78';
    }, 4000);
  }

  printSaleTest() {
    this.printer.printReceipt(`
========================================
        3EATCRU GOURMET & VAREJO
CNPJ: 12.345.678/0001-90
Rua do Comércio, 100 - São Paulo, SP
========================================
         TESTE DE IMPRESSÃO ESC/POS
----------------------------------------
01 X-Burger Artesanal Bacon    R$ 34,90
02 Coca-Cola Lata 350ml        R$ 14,00
----------------------------------------
TOTAL A PAGAR:                 R$ 48,90
FORMA DE PAGAMENTO (TEF):      R$ 48,90
========================================
     OBRIGADO PELA PREFERÊNCIA!
    `);
  }

  printCloseTest() {
    this.printer.printReceipt(`
========================================
       3EATCRU OS - CONTROLE DE CAIXA
    RELATORIO DE FECHAMENTO DE TURNO
========================================
OPERADOR: Administrador
DATA: ${this.todayStr}
----------------------------------------
(+) FUNDO DE ABERTURA:        R$ 150,00
(+) VENDAS EM DINHEIRO:       R$ 840,00
(+) VENDAS EM TEF DÉBITO:     R$ 1.250,00
(+) VENDAS EM TEF CRÉDITO:    R$ 980,00
(+) VENDAS EM PIX:            R$ 450,00
----------------------------------------
(=) TOTAL EM GAVETA:          R$ 990,00
========================================
    `);
  }

  printCurrentTape() {
    this.printSaleTest();
  }

  async openNewDeviceModal() {
    const compId = this.context.companyId() || 'EMP_001';
    const newDev: HardwareDevice = {
      id: this.idGen.generatePrefixedId('dev'),
      companyId: compId,
      name: 'Balança Toledo Prix 3 Plus (USB-Serial)',
      category: 'scale',
      connectionType: 'web_serial',
      baudRate: 9600,
      status: 'connected',
      isDefault: true
    };
    await this.engine.saveEntity('hardwareDevices', newDev, 'CREATE');
    await this.loadDevices();
  }

  async removeDevice(d: HardwareDevice) {
    await this.engine.deleteEntity('hardwareDevices', d.id);
    await this.loadDevices();
  }

  testDevice(d: HardwareDevice) {
    console.log(`[Hardware] Test command sent to ${d.name} (${d.category})`);
  }

  getIcon(cat: string): string {
    switch (cat) {
      case 'printer': return 'print';
      case 'scale': return 'scale';
      case 'cash_drawer': return 'point_of_sale';
      case 'tef': return 'credit_card';
      case 'barcode_scanner': return 'qr_code_scanner';
      case 'customer_display': return 'desktop_windows';
      default: return 'devices';
    }
  }
}
