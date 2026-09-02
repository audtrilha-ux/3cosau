import { Component, ChangeDetectionStrategy, signal, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { db } from '../../core/storage/dexie.db';
import { WhatsappTemplate } from '../../core/models';
import { AppContextService } from '../../core/services/app-context.service';
import { TransactionEngine } from '../../core/workflow/transaction.engine';
import { IdGeneratorService } from '../../core/services/id-generator.service';

interface MessageLog {
  id: string;
  recipient: string;
  phone: string;
  message: string;
  status: 'ENVIADO' | 'ENTREGUE' | 'LIDO';
  timestamp: number;
}

@Component({
  selector: 'app-whatsapp',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col bg-zinc-50 text-zinc-800 p-4 space-y-4 overflow-hidden select-none">
      <!-- Top Header -->
      <div class="flex items-center justify-between pb-3 border-b border-zinc-200 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <mat-icon>chat</mat-icon>
          </div>
          <div>
            <h2 class="text-base font-bold text-zinc-900 leading-tight">WhatsApp Communication Hub</h2>
            <p class="text-xs text-zinc-500">Disparos automáticos e templates transacionais integrados a vendas, delivery e cobrança</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Meta Cloud API Ativa
          </span>
          <button
            type="button"
            (click)="openModal()"
            class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <mat-icon class="text-sm">add_circle</mat-icon>
            <span>Novo Template</span>
          </button>
        </div>
      </div>

      <!-- Main Columns Split -->
      <div class="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 overflow-hidden">
        <!-- Left: Templates List (7 cols) -->
        <div class="lg:col-span-7 bg-white border border-zinc-200 rounded-2xl shadow-sm p-4 flex flex-col min-h-0">
          <h3 class="text-xs font-bold uppercase text-zinc-700 mb-3 tracking-wider flex items-center gap-1.5">
            <mat-icon class="text-sm text-emerald-600">copy_all</mat-icon>
            Templates Transacionais Ativos
          </h3>
          <div class="flex-1 overflow-y-auto space-y-3 pr-1">
            @for (tpl of templates(); track tpl.id) {
              <div class="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
                <div class="flex items-center justify-between">
                  <div class="font-bold text-xs text-zinc-900">{{ tpl.title }}</div>
                  <span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[9px] font-bold">
                    Gatilho: {{ tpl.triggerEvent }}
                  </span>
                </div>
                <div class="bg-white border border-zinc-200 p-2.5 rounded-lg text-xs font-mono text-zinc-700 whitespace-pre-wrap leading-relaxed">
                  {{ tpl.content }}
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Right: Simulator / Direct Dispatch (5 cols) -->
        <div class="lg:col-span-5 bg-white border border-zinc-200 rounded-2xl shadow-sm p-4 flex flex-col min-h-0 space-y-4">
          <h3 class="text-xs font-bold uppercase text-zinc-700 tracking-wider flex items-center gap-1.5">
            <mat-icon class="text-sm text-indigo-600">send</mat-icon>
            Simulador de Disparo
          </h3>

          <div class="space-y-3 text-xs flex-1 overflow-y-auto pr-1">
            @if (feedbackMsg()) {
              <div class="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                <mat-icon class="text-sm text-emerald-600">check_circle</mat-icon>
                <span>{{ feedbackMsg() }}</span>
              </div>
            }

            <div>
              <label class="block font-semibold text-zinc-700 mb-1">Nome do Destinatário</label>
              <input type="text" [value]="simRecipient()" (input)="simRecipient.set($any($event.target).value)" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900" />
            </div>

            <div>
              <label class="block font-semibold text-zinc-700 mb-1">WhatsApp (DDD + Número)</label>
              <input type="text" [value]="simPhone()" (input)="simPhone.set($any($event.target).value)" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 font-mono" />
            </div>

            <div>
              <label class="block font-semibold text-zinc-700 mb-1">Selecione o Template</label>
              <select [value]="selectedTplId()" (change)="selectedTplId.set($any($event.target).value)" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900">
                @for (tpl of templates(); track tpl.id) {
                  <option [value]="tpl.id">{{ tpl.title }}</option>
                }
              </select>
            </div>

            <button type="button" (click)="simulateSend()" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer">
              <mat-icon class="text-sm">send</mat-icon>
              <span>Disparar Mensagem</span>
            </button>

            <!-- Feed of sent logs -->
            <div class="pt-2 border-t border-zinc-100 space-y-2">
              <span class="text-[10px] uppercase font-bold text-zinc-400">Histórico de Disparos Recentes:</span>
              <div class="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                @for (log of messageLogs(); track log.id) {
                  <div class="p-2 bg-zinc-50 rounded-lg border border-zinc-200 text-[11px] space-y-1">
                    <div class="flex justify-between font-bold text-zinc-800">
                      <span>{{ log.recipient }}</span>
                      <span class="text-emerald-700 font-mono">{{ log.status }} ✓✓</span>
                    </div>
                    <div class="text-zinc-500 font-mono text-[10px] truncate">{{ log.message }}</div>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Add Template Modal -->
      @if (showModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div class="bg-white border border-zinc-200 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 class="text-sm font-bold text-zinc-900">Novo Template de Mensagem</h3>
              <button (click)="showModal.set(false)" class="text-zinc-400 hover:text-zinc-600"><mat-icon>close</mat-icon></button>
            </div>

            <form [formGroup]="form" (ngSubmit)="saveTemplate()" class="space-y-3 text-xs">
              <div>
                <label class="block font-semibold text-zinc-700 mb-1">Título do Template *</label>
                <input type="text" formControlName="title" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900" placeholder="Ex: Notificação de Entrega" />
              </div>
              <div>
                <label class="block font-semibold text-zinc-700 mb-1">Gatilho (Trigger)</label>
                <input type="text" formControlName="triggerEvent" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 font-mono" placeholder="Ex: venda_concluida" />
              </div>
              <div>
                <label class="block font-semibold text-zinc-700 mb-1">Conteúdo da Mensagem *</label>
                <textarea formControlName="content" rows="4" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 resize-none font-mono" placeholder="Olá [cliente], seu pedido foi registrado..."></textarea>
              </div>

              <div class="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
                <button type="button" (click)="showModal.set(false)" class="px-4 py-2 rounded-xl bg-zinc-100 text-zinc-700 font-bold">Cancelar</button>
                <button type="submit" [disabled]="form.invalid" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold shadow-md">Salvar Template</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class WhatsappComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private fb = inject(FormBuilder);
  private context = inject(AppContextService);
  private txEngine = inject(TransactionEngine);
  private idGen = inject(IdGeneratorService);

  templates = signal<WhatsappTemplate[]>([]);
  messageLogs = signal<MessageLog[]>([
    { id: '1', recipient: 'Mariana Silva', phone: '(11) 98765-4321', message: 'Olá, Mariana! Seu cupom no valor de R$ 85,50 foi emitido.', status: 'LIDO', timestamp: Date.now() - 600000 }
  ]);

  showModal = signal(false);
  simRecipient = signal('Mariana Silva Costa');
  simPhone = signal('(11) 98765-4321');
  selectedTplId = signal('');
  feedbackMsg = signal<string | null>(null);

  form = this.fb.group({
    title: ['', Validators.required],
    triggerEvent: ['venda_concluida', Validators.required],
    content: ['', Validators.required]
  });

  async ngOnInit() {
    await this.loadTemplates();
  }

  async loadTemplates() {
    if (!isPlatformBrowser(this.platformId)) return;
    const currentCompanyId = this.context.companyId();
    const list = await db.whatsappTemplates.where('companyId').equals(currentCompanyId).toArray();
    this.templates.set(list);
    if (list.length > 0 && !this.selectedTplId()) this.selectedTplId.set(list[0].id);
  }

  openModal() {
    this.form.reset({
      title: '',
      triggerEvent: 'venda_concluida',
      content: 'Olá, {{cliente}}! Seu pedido foi confirmado com sucesso. Obrigado!'
    });
    this.showModal.set(true);
  }

  async saveTemplate() {
    if (this.form.invalid || !isPlatformBrowser(this.platformId)) return;
    const val = this.form.value;

    const newTpl: WhatsappTemplate = {
      id: this.idGen.generatePrefixedId('wa'),
      companyId: this.context.companyId(),
      title: val.title!,
      triggerEvent: val.triggerEvent || 'venda_concluida',
      content: val.content!,
      active: true
    };

    await this.txEngine.saveEntity('whatsappTemplates', newTpl, 'CREATE');
    this.showModal.set(false);
    await this.loadTemplates();
  }

  simulateSend() {
    const tpl = this.templates().find(t => t.id === this.selectedTplId());
    if (!tpl) return;
    const recipient = this.simRecipient();
    const msg = tpl.content.replace('{{cliente}}', recipient).replace('{{valor}}', 'R$ 89,90');

    const log: MessageLog = {
      id: this.idGen.generatePrefixedId('msg-log'),
      recipient,
      phone: this.simPhone(),
      message: msg,
      status: 'ENTREGUE',
      timestamp: Date.now()
    };

    this.messageLogs.update(list => [log, ...list]);
    this.feedbackMsg.set(`Mensagem enviada com sucesso para ${recipient}!`);
    setTimeout(() => this.feedbackMsg.set(null), 4000);
  }
}
