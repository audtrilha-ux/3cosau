import { AppManifest } from '../core/services/app-registry';
import { OS_VERSION } from '../core/constants/version';

/**
 * 3eatcru Apps Manifest Catalog
 * Localizado no domínio de módulos de negócio (/modules/), mantendo o Core e o Shell totalmente desacoplados.
 */
export const BUSINESS_APP_MANIFESTS: AppManifest[] = [
  // Operação & Caixa
  {
    id: 'pdv',
    name: 'PDV (Frente de Caixa)',
    category: 'OPERACAO',
    icon: 'point_of_sale',
    iconColor: 'text-indigo-600',
    loadComponent: () => import('./vendas/pdv.component').then(m => m.PdvComponent),
    shortcut: 'F2',
    version: OS_VERSION
  },
  {
    id: 'caixa',
    name: 'Controle de Caixa',
    category: 'OPERACAO',
    icon: 'payments',
    iconColor: 'text-emerald-600',
    loadComponent: () => import('./caixa/caixa.component').then(m => m.CaixaComponent),
    shortcut: 'F4',
    version: OS_VERSION
  },
  {
    id: 'mesas',
    name: 'Mesas & Comandas',
    category: 'OPERACAO',
    icon: 'restaurant',
    iconColor: 'text-orange-600',
    loadComponent: () => import('./mesas/mesas.component').then(m => m.MesasComponent),
    version: OS_VERSION
  },
  {
    id: 'delivery',
    name: 'Delivery & Despacho',
    category: 'OPERACAO',
    icon: 'two_wheeler',
    iconColor: 'text-rose-600',
    loadComponent: () => import('./delivery/delivery.component').then(m => m.DeliveryComponent),
    badge: 'NOVO',
    version: OS_VERSION
  },
  {
    id: 'cardapio',
    name: 'Cardápio Digital & QR',
    category: 'OPERACAO',
    icon: 'restaurant_menu',
    iconColor: 'text-amber-600',
    loadComponent: () => import('./cardapio/cardapio.component').then(m => m.CardapioComponent),
    version: OS_VERSION
  },
  {
    id: 'hardware',
    name: 'Hardware & ESC/POS',
    category: 'OPERACAO',
    icon: 'print',
    iconColor: 'text-cyan-600',
    loadComponent: () => import('./hardware/hardware.component').then(m => m.HardwareComponent),
    version: OS_VERSION
  },

  // Suprimentos & Estoque
  {
    id: 'estoque',
    name: 'Kardex Estoque',
    category: 'SUPRIMENTOS',
    icon: 'inventory_2',
    iconColor: 'text-purple-600',
    loadComponent: () => import('./estoque/estoque.component').then(m => m.EstoqueComponent),
    version: OS_VERSION
  },
  {
    id: 'compras',
    name: 'Compras & Entrada NF-e',
    category: 'SUPRIMENTOS',
    icon: 'shopping_bag',
    iconColor: 'text-blue-600',
    loadComponent: () => import('./compras/compras.component').then(m => m.ComprasComponent),
    badge: 'XML',
    version: OS_VERSION
  },
  {
    id: 'fornecedores',
    name: 'Fornecedores & Catálogo',
    category: 'SUPRIMENTOS',
    icon: 'local_shipping',
    iconColor: 'text-teal-600',
    loadComponent: () => import('./fornecedores/fornecedores.component').then(m => m.FornecedoresComponent),
    version: OS_VERSION
  },

  // Clientes & Vendas
  {
    id: 'clientes',
    name: 'Fiado & Clientes',
    category: 'CLIENTES',
    icon: 'groups',
    iconColor: 'text-blue-600',
    loadComponent: () => import('./clientes/clientes.component').then(m => m.ClientesComponent),
    version: OS_VERSION
  },
  {
    id: 'crm',
    name: 'CRM & Pipeline',
    category: 'CLIENTES',
    icon: 'trending_up',
    iconColor: 'text-indigo-600',
    loadComponent: () => import('./crm/crm.component').then(m => m.CrmComponent),
    version: OS_VERSION
  },
  {
    id: 'fidelidade',
    name: 'Fidelidade & Vouchers',
    category: 'CLIENTES',
    icon: 'loyalty',
    iconColor: 'text-amber-600',
    loadComponent: () => import('./fidelidade/fidelidade.component').then(m => m.FidelidadeComponent),
    version: OS_VERSION
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Hub',
    category: 'CLIENTES',
    icon: 'chat',
    iconColor: 'text-emerald-600',
    loadComponent: () => import('./whatsapp/whatsapp.component').then(m => m.WhatsappComponent),
    version: OS_VERSION
  },

  // Serviços & Produção
  {
    id: 'servicos',
    name: 'Ordens de Serviço (OS)',
    category: 'PRODUCAO',
    icon: 'handyman',
    iconColor: 'text-cyan-600',
    loadComponent: () => import('./servicos/servicos.component').then(m => m.ServicosComponent),
    version: OS_VERSION
  },
  {
    id: 'fabricacao',
    name: 'Produção & MRP',
    category: 'PRODUCAO',
    icon: 'factory',
    iconColor: 'text-purple-600',
    loadComponent: () => import('./fabricacao/fabricacao.component').then(m => m.FabricacaoComponent),
    version: OS_VERSION
  },
  {
    id: 'projetos',
    name: 'Projetos & Tarefas',
    category: 'PRODUCAO',
    icon: 'view_kanban',
    iconColor: 'text-indigo-600',
    loadComponent: () => import('./projetos/projetos.component').then(m => m.ProjetosComponent),
    version: OS_VERSION
  },

  // Gestão & ERP
  {
    id: 'financeiro',
    name: 'Financeiro & DRE',
    category: 'GESTAO',
    icon: 'account_balance',
    iconColor: 'text-rose-600',
    loadComponent: () => import('./financeiro/financeiro.component').then(m => m.FinanceiroComponent),
    version: OS_VERSION
  },
  {
    id: 'servicos_contratados',
    name: 'Serviços Contratados',
    category: 'GESTAO',
    icon: 'receipt_long',
    iconColor: 'text-emerald-600',
    loadComponent: () => import('./servicos-contratados/servicos-contratados.component').then(m => m.ServicosContratadosComponent),
    version: OS_VERSION
  },
  {
    id: 'funcionarios',
    name: 'Funcionários & RBAC',
    category: 'GESTAO',
    icon: 'badge',
    iconColor: 'text-purple-600',
    loadComponent: () => import('./funcionarios/funcionarios.component').then(m => m.FuncionariosComponent),
    version: OS_VERSION
  },
  {
    id: 'relatorios',
    name: 'Analytics & Relatórios',
    category: 'GESTAO',
    icon: 'bar_chart',
    iconColor: 'text-zinc-600',
    loadComponent: () => import('./relatorios/relatorios.component').then(m => m.RelatoriosComponent),
    version: OS_VERSION
  }
];
