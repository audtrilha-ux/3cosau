import { Component, ChangeDetectionStrategy, signal, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { db } from '../../core/storage/dexie.db';
import { ProjectTask } from '../../core/models';
import { AppContextService } from '../../core/services/app-context.service';
import { TransactionEngine } from '../../core/workflow/transaction.engine';
import { IdGeneratorService } from '../../core/services/id-generator.service';

@Component({
  selector: 'app-projetos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col bg-zinc-50 text-zinc-800 p-4 space-y-4 overflow-hidden select-none">
      <!-- Top Header -->
      <div class="flex items-center justify-between pb-3 border-b border-zinc-200 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
            <mat-icon>view_kanban</mat-icon>
          </div>
          <div>
            <h2 class="text-base font-bold text-zinc-900 leading-tight">Projetos & Tarefas Operacionais (Kanban)</h2>
            <p class="text-xs text-zinc-500">Acompanhamento visual de demandas de equipe, prazos e responsabilidades</p>
          </div>
        </div>
        <button
          type="button"
          (click)="openModal()"
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <mat-icon class="text-sm">add_circle</mat-icon>
          <span>Nova Tarefa</span>
        </button>
      </div>

      <!-- Kanban 4 Columns -->
      <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-h-0 overflow-hidden">
        <!-- 1. Novo -->
        <div class="bg-white rounded-2xl border border-zinc-200 p-3 flex flex-col shadow-sm">
          <div class="flex items-center justify-between pb-2 border-b border-zinc-100 mb-2">
            <span class="text-xs font-bold text-zinc-700 uppercase flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-indigo-400"></span> Novo
            </span>
            <span class="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-mono text-[10px] font-bold">{{ getStage('novo').length }}</span>
          </div>
          <div class="flex-1 overflow-y-auto space-y-2 pr-1">
            @for (t of getStage('novo'); track t.id) {
              <div class="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2 shadow-xs">
                <div class="flex justify-between items-start">
                  <span class="text-[9px] uppercase font-bold text-indigo-600 px-1.5 py-0.2 rounded bg-indigo-50 border border-indigo-200">{{ t.project }}</span>
                  <span class="text-[9px] uppercase font-bold" [class.text-rose-600]="t.priority === 'alta'" [class.text-zinc-500]="t.priority !== 'alta'">{{ t.priority }}</span>
                </div>
                <h4 class="font-bold text-xs text-zinc-900 leading-snug">{{ t.title }}</h4>
                <div class="text-[10px] text-zinc-500 flex items-center gap-1"><mat-icon class="text-[12px]">person</mat-icon> {{ t.assignee }}</div>
                <div class="flex justify-between items-center pt-2 border-t border-zinc-200 text-xs">
                  <span class="text-[10px] text-zinc-400">{{ t.dueDate | date:'dd/MM' }}</span>
                  <button (click)="move(t.id, 'em_progresso')" class="px-2 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded font-bold text-[10px]">Iniciar →</button>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- 2. Em Progresso -->
        <div class="bg-white rounded-2xl border border-zinc-200 p-3 flex flex-col shadow-sm">
          <div class="flex items-center justify-between pb-2 border-b border-zinc-100 mb-2">
            <span class="text-xs font-bold text-zinc-700 uppercase flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span> Em Progresso
            </span>
            <span class="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-mono text-[10px] font-bold">{{ getStage('em_progresso').length }}</span>
          </div>
          <div class="flex-1 overflow-y-auto space-y-2 pr-1">
            @for (t of getStage('em_progresso'); track t.id) {
              <div class="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2 shadow-xs">
                <div class="flex justify-between items-start">
                  <span class="text-[9px] uppercase font-bold text-sky-600 px-1.5 py-0.2 rounded bg-sky-50 border border-sky-200">{{ t.project }}</span>
                  <span class="text-[9px] uppercase font-bold" [class.text-rose-600]="t.priority === 'alta'" [class.text-zinc-500]="t.priority !== 'alta'">{{ t.priority }}</span>
                </div>
                <h4 class="font-bold text-xs text-zinc-900 leading-snug">{{ t.title }}</h4>
                <div class="text-[10px] text-zinc-500 flex items-center gap-1"><mat-icon class="text-[12px]">person</mat-icon> {{ t.assignee }}</div>
                <div class="flex justify-between items-center pt-2 border-t border-zinc-200 text-xs">
                  <span class="text-[10px] text-zinc-400">{{ t.dueDate | date:'dd/MM' }}</span>
                  <button (click)="move(t.id, 'revisao')" class="px-2 py-0.5 bg-sky-100 hover:bg-sky-200 text-sky-800 rounded font-bold text-[10px]">Revisão →</button>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- 3. Em Revisão -->
        <div class="bg-white rounded-2xl border border-zinc-200 p-3 flex flex-col shadow-sm">
          <div class="flex items-center justify-between pb-2 border-b border-zinc-100 mb-2">
            <span class="text-xs font-bold text-zinc-700 uppercase flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-amber-500"></span> Em Revisão
            </span>
            <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono text-[10px] font-bold">{{ getStage('revisao').length }}</span>
          </div>
          <div class="flex-1 overflow-y-auto space-y-2 pr-1">
            @for (t of getStage('revisao'); track t.id) {
              <div class="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2 shadow-xs">
                <div class="flex justify-between items-start">
                  <span class="text-[9px] uppercase font-bold text-amber-600 px-1.5 py-0.2 rounded bg-amber-50 border border-amber-200">{{ t.project }}</span>
                  <span class="text-[9px] uppercase font-bold" [class.text-rose-600]="t.priority === 'alta'" [class.text-zinc-500]="t.priority !== 'alta'">{{ t.priority }}</span>
                </div>
                <h4 class="font-bold text-xs text-zinc-900 leading-snug">{{ t.title }}</h4>
                <div class="text-[10px] text-zinc-500 flex items-center gap-1"><mat-icon class="text-[12px]">person</mat-icon> {{ t.assignee }}</div>
                <div class="flex justify-between items-center pt-2 border-t border-zinc-200 text-xs">
                  <span class="text-[10px] text-zinc-400">{{ t.dueDate | date:'dd/MM' }}</span>
                  <button (click)="move(t.id, 'concluido')" class="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-bold text-[10px]">Concluir ✓</button>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- 4. Concluído -->
        <div class="bg-white rounded-2xl border border-zinc-200 p-3 flex flex-col shadow-sm">
          <div class="flex items-center justify-between pb-2 border-b border-zinc-100 mb-2">
            <span class="text-xs font-bold text-zinc-700 uppercase flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Concluído
            </span>
            <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">{{ getStage('concluido').length }}</span>
          </div>
          <div class="flex-1 overflow-y-auto space-y-2 pr-1">
            @for (t of getStage('concluido'); track t.id) {
              <div class="bg-emerald-50/40 border border-emerald-200 rounded-xl p-3 space-y-1.5 opacity-85 shadow-xs">
                <div class="flex justify-between items-start">
                  <span class="text-[9px] uppercase font-bold text-emerald-700 px-1.5 py-0.2 rounded bg-emerald-100">{{ t.project }}</span>
                  <span class="text-[9px] text-emerald-700 font-bold">FEITO</span>
                </div>
                <h4 class="font-bold text-xs text-zinc-800 leading-snug line-through">{{ t.title }}</h4>
                <div class="text-[10px] text-zinc-500 flex items-center gap-1"><mat-icon class="text-[12px]">person</mat-icon> {{ t.assignee }}</div>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Add Task Modal -->
      @if (showModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div class="bg-white border border-zinc-200 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 class="text-sm font-bold text-zinc-900">Nova Demanda / Tarefa</h3>
              <button (click)="showModal.set(false)" class="text-zinc-400 hover:text-zinc-600"><mat-icon>close</mat-icon></button>
            </div>

            <form [formGroup]="form" (ngSubmit)="save()" class="space-y-3 text-xs">
              <div>
                <label class="block font-semibold text-zinc-700 mb-1">Título da Tarefa *</label>
                <input type="text" formControlName="title" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900" placeholder="Ex: Auditoria de estoque mensal" />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Projeto / Área *</label>
                  <input type="text" formControlName="project" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900" placeholder="Ex: Logística" />
                </div>
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Responsável *</label>
                  <input type="text" formControlName="assignee" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900" placeholder="Nome do colaborador" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Prioridade</label>
                  <select formControlName="priority" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900">
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
                <div>
                  <label class="block font-semibold text-zinc-700 mb-1">Estágio Inicial</label>
                  <select formControlName="stage" class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900">
                    <option value="novo">Novo</option>
                    <option value="em_progresso">Em Progresso</option>
                    <option value="revisao">Revisão</option>
                    <option value="concluido">Concluído</option>
                  </select>
                </div>
              </div>

              <div class="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
                <button type="button" (click)="showModal.set(false)" class="px-4 py-2 rounded-xl bg-zinc-100 text-zinc-700 font-bold">Cancelar</button>
                <button type="submit" [disabled]="form.invalid" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold shadow-md">Salvar Tarefa</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class ProjetosComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private fb = inject(FormBuilder);
  private context = inject(AppContextService);
  private txEngine = inject(TransactionEngine);
  private idGen = inject(IdGeneratorService);

  tasks = signal<ProjectTask[]>([]);
  showModal = signal(false);

  getStage = (st: ProjectTask['stage']) => this.tasks().filter(t => t.stage === st);

  form = this.fb.group({
    title: ['', Validators.required],
    project: ['Operações', Validators.required],
    assignee: ['Equipe', Validators.required],
    priority: ['media' as 'baixa' | 'media' | 'alta'],
    stage: ['novo' as ProjectTask['stage']]
  });

  async ngOnInit() {
    await this.loadTasks();
  }

  async loadTasks() {
    if (!isPlatformBrowser(this.platformId)) return;
    const currentCompanyId = this.context.companyId();
    const list = await db.projectTasks.where('companyId').equals(currentCompanyId).toArray();
    this.tasks.set(list.reverse());
  }

  openModal() {
    this.form.reset({
      title: '',
      project: 'Operações',
      assignee: 'Equipe',
      priority: 'media',
      stage: 'novo'
    });
    this.showModal.set(true);
  }

  async save() {
    if (this.form.invalid || !isPlatformBrowser(this.platformId)) return;
    const val = this.form.value;
    const now = Date.now();

    const newTask: ProjectTask = {
      id: this.idGen.generatePrefixedId('tsk'),
      companyId: this.context.companyId(),
      title: val.title!,
      project: val.project!,
      assignee: val.assignee || 'Equipe',
      priority: val.priority || 'media',
      stage: val.stage || 'novo',
      dueDate: now + 86400000 * 3,
      createdAt: now
    };

    await this.txEngine.saveEntity('projectTasks', newTask, 'CREATE');
    this.showModal.set(false);
    await this.loadTasks();
  }

  async move(id: string, next: ProjectTask['stage']) {
    if (!isPlatformBrowser(this.platformId)) return;
    const task = await db.projectTasks.get(id);
    if (task) {
      const updated = { ...task, stage: next };
      await this.txEngine.saveEntity('projectTasks', updated, 'UPDATE');
    }
    await this.loadTasks();
  }
}
