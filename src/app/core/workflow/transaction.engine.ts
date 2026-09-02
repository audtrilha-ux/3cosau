import { Injectable, inject } from '@angular/core';
import { db } from '../storage/dexie.db';
import { SyncOutboxService } from '../sync/sync-outbox.service';
import { AppContextService } from '../services/app-context.service';
import { IdGeneratorService } from '../services/id-generator.service';
import { OSContextImpl } from '../services/os-context-impl';
import { 
  getEntityTypeForTable, 
  TABLE_TO_PERMISSION 
} from '../constants/entity-type-registry';
import { 
  Sale, 
  SaleItem, 
  PaymentEntry, 
  StockMovement, 
  CashMovement, 
  CashSession, 
  AuditLog,
  Product,
  Operator,
  Customer,
  CashDenominationCount,
  PurchaseOrder,
  ManufacturingOrder,
  FinancialTransaction
} from '../models';

@Injectable({ providedIn: 'root' })
export class TransactionEngine {
  private syncOutbox = inject(SyncOutboxService);
  private context = inject(AppContextService);
  private idGen = inject(IdGeneratorService);
  private osContext = inject(OSContextImpl);

  /**
   * Completes a sale transaction atomically with domain event emission.
   */
  async processSale(params: {
    items: SaleItem[];
    payments: PaymentEntry[];
    customerId?: string;
    customerName?: string;
    discount?: number;
    operatorName?: string;
    tableNumber?: number;
  }): Promise<Sale> {
    this.osContext.permissions.assertPermission('PROCESS_SALE', 'vendas');

    if (params.items.length === 0) {
      throw new Error('Operação bloqueada: A venda deve conter ao menos um item.');
    }

    const currentCompId = this.context.companyId();
    const currentLocId = this.context.locationId();
    const currentOp = this.context.currentOperator();

    if (!currentCompId || !currentLocId) {
      throw new Error('Operação bloqueada: O terminal operacional precisa estar pareado e configurado para processar vendas.');
    }

    if (!currentOp) {
      throw new Error('Operação bloqueada: É necessário um operador autenticado e ativo para realizar vendas.');
    }

    // 1. Validar e Recalcular os Itens de Venda de forma core-authoritative no Banco (Ignorando adulterações do cliente)
    const validatedItems: SaleItem[] = [];
    let computedSubtotal = 0;

    for (const item of params.items) {
      const product = await db.products.get(item.productId);
      if (!product) {
        throw new Error(`Operação bloqueada: Produto com ID "${item.productId}" não existe no banco de dados.`);
      }
      
      const unitPrice = product.price; // Forçar o preço oficial do banco
      const totalPrice = Math.round(unitPrice * item.quantity * 100) / 100;
      
      validatedItems.push({
        ...item,
        productName: product.name,
        unitPrice: unitPrice,
        totalPrice: totalPrice
      });
      
      computedSubtotal += totalPrice;
    }

    const subtotal = Math.round(computedSubtotal * 100) / 100;
    const discount = Math.round((params.discount || 0) * 100) / 100;
    const total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);

    const totalPayments = Math.round(params.payments.reduce((acc, p) => acc + p.amount, 0) * 100) / 100;
    if (totalPayments < total - 0.01) {
      throw new Error('Operação bloqueada: O valor pago (R$ ' + totalPayments.toFixed(2) + ') é insuficiente para o total da venda (R$ ' + total.toFixed(2) + ').');
    }
    const changeAmount = Math.max(0, Math.round((totalPayments - total) * 100) / 100);

    // 2. Validar Política de Crédito de Fiado se houver pagamentos em fiado
    const totalFiado = params.payments
      .filter(p => p.method === 'fiado')
      .reduce((sum, p) => sum + p.amount, 0);

    if (totalFiado > 0) {
      if (!params.customerId) {
        throw new Error('Operação bloqueada: Vendas na modalidade "Fiado" necessitam obrigatoriamente da associação de um cliente cadastrado.');
      }
      const customer = await db.customers.get(params.customerId);
      if (!customer) {
        throw new Error('Operação bloqueada: O cliente especificado para venda fiada não foi encontrado.');
      }
      if (customer.blocked) {
        throw new Error(`Operação bloqueada: O cliente "${customer.name}" encontra-se bloqueado e impedido de realizar novas compras em fiado.`);
      }
      const limitAvailable = Math.round((customer.creditLimit - (customer.currentDebt || 0)) * 100) / 100;
      if (totalFiado > limitAvailable) {
        throw new Error(`Operação bloqueada: Limite de crédito excedido para o cliente "${customer.name}". Limite disponível: R$ ${limitAvailable.toFixed(2)}, Valor solicitado: R$ ${totalFiado.toFixed(2)}.`);
      }
    }

    const saleId = this.idGen.generatePrefixedId('venda');
    const code = this.idGen.generateTransactionCode('VND');
    const opName = currentOp.name;
    const opId = currentOp.id;

    const sale: Sale = {
      id: saleId,
      companyId: currentCompId,
      locationId: currentLocId,
      code,
      items: validatedItems,
      subtotal,
      discount,
      total,
      change: changeAmount > 0 ? changeAmount : undefined,
      payments: params.payments,
      customerId: params.customerId,
      customerName: params.customerName,
      operatorId: opId,
      operatorName: opName,
      tableNumber: params.tableNumber,
      status: 'COMPLETED',
      createdAt: Date.now()
    };

    // Execute atomic Dexie transaction
    await db.transaction('rw', [db.sales, db.products, db.stockMovements, db.customers, db.cashSessions, db.auditLogs, db.outbox], async () => {
      // 1. Save sale
      await db.sales.put(sale);

      // 2. Decrement stock & record Kardex
      for (const item of validatedItems) {
        const product = await db.products.get(item.productId);
        if (!product) {
          throw new Error(`Produto inexistente na transação: ${item.productId}`);
        }
        const prevStock = product.stock;
        const newStock = prevStock - item.quantity;
        const allowNegative = product.allowNegativeStock ?? false;
        if (newStock < 0 && !allowNegative) {
          throw new Error(`Estoque insuficiente para o produto "${product.name}". Disponível: ${prevStock}, Solicitado: ${item.quantity}`);
        }
        product.stock = newStock;
        product.updatedAt = Date.now();
        await db.products.put(product);

        const stockMov: StockMovement = {
          id: this.idGen.generatePrefixedId('mov-stk'),
          companyId: sale.companyId,
          productId: product.id,
          productName: product.name,
          type: 'SAIDA_VENDA',
          quantity: item.quantity,
          previousStock: prevStock,
          newStock,
          reason: `Venda ${sale.code}`,
          operatorName: sale.operatorName,
          timestamp: Date.now()
        };
        await db.stockMovements.put(stockMov);
        await this.syncOutbox.enqueue('STOCK_MOVEMENT', stockMov.id, 'CREATE', stockMov);
      }

      // 3. Handle Fiado customer balance
      if (totalFiado > 0 && params.customerId) {
        const customer = await db.customers.get(params.customerId);
        if (customer) {
          customer.currentDebt = Math.round(((customer.currentDebt || 0) + totalFiado) * 100) / 100;
          customer.updatedAt = Date.now();
          await db.customers.put(customer);
        }
      }

      // 4. Update Cash Session if there was cash received (net of change returned to customer)
      const totalCashPaid = params.payments
        .filter(p => p.method === 'dinheiro')
        .reduce((sum, p) => sum + p.amount, 0);
      if (totalCashPaid > 0) {
        const netCashAmount = Math.max(0, Math.round((totalCashPaid - changeAmount) * 100) / 100);
        const activeSession = await db.cashSessions
          .filter(s => s.status === 'OPEN' && s.companyId === currentCompId && (!currentLocId || s.locationId === currentLocId))
          .first();
        if (activeSession && netCashAmount > 0) {
          const cashMov: CashMovement = {
            id: this.idGen.generatePrefixedId('mov-csh'),
            sessionId: activeSession.id,
            type: 'VENDA',
            amount: netCashAmount,
            reason: `Venda ${sale.code}${changeAmount > 0 ? ` (Pago Dinheiro: R$ ${totalCashPaid.toFixed(2)}, Troco: R$ ${changeAmount.toFixed(2)})` : ''}`,
            operatorName: sale.operatorName,
            timestamp: Date.now()
          };
          activeSession.movements.push(cashMov);
          await db.cashSessions.put(activeSession);
          await this.syncOutbox.enqueue('CASH_MOVEMENT', cashMov.id, 'CREATE', cashMov);
        }
      }

      // 5. Audit Log
      const audit: AuditLog = {
        id: this.idGen.generatePrefixedId('aud'),
        companyId: currentCompId,
        actor: sale.operatorName,
        action: 'FINALIZAR_VENDA',
        resource: 'Vendas',
        resourceId: sale.id,
        details: `Venda ${sale.code} finalizada no valor de R$ ${sale.total.toFixed(2)}`,
        timestamp: Date.now()
      };
      await db.auditLogs.put(audit);
      await this.syncOutbox.enqueue('SALE', sale.id, 'CREATE', sale);
    });

    // Publish domain event
    this.osContext.events.publishDomainEvent({
      id: this.idGen.generatePrefixedId('evt'),
      topic: 'events.sales',
      aggregate: 'SALE',
      aggregateId: sale.id,
      eventType: 'SALE_COMPLETED',
      payload: sale,
      actor: sale.operatorName,
      timestamp: Date.now()
    });

    return sale;
  }


  /**
   * Cash Movement (Suprimento ou Sangria)
   */
  async addCashMovement(type: 'SUPRIMENTO' | 'SANGRIA', amount: number, reason: string): Promise<void> {
    this.osContext.permissions.assertPermission(type, 'caixa');

    const currentCompId = this.context.companyId();
    const currentLocId = this.context.locationId();
    const currentOp = this.context.currentOperator();

    if (!currentCompId) {
      throw new Error('Operação bloqueada: Terminal não configurado.');
    }

    if (!currentOp) {
      throw new Error('Operação bloqueada: É necessário estar autenticado para realizar suprimento ou sangria.');
    }

    const activeSession = await db.cashSessions
      .filter(s => s.status === 'OPEN' && s.companyId === currentCompId && (!currentLocId || s.locationId === currentLocId))
      .first();
    if (!activeSession) {
      throw new Error('Nenhum turno de caixa aberto no momento.');
    }

    const opName = currentOp.name;

    let mov: CashMovement;
    await db.transaction('rw', [db.cashSessions, db.auditLogs, db.outbox], async () => {
    mov = {
      id: this.idGen.generatePrefixedId('mov-csh'),
      sessionId: activeSession.id,
      type,
      amount,
      reason,
      operatorName: opName,
      timestamp: Date.now()
    };

    activeSession.movements.push(mov);
    await db.cashSessions.put(activeSession);

    const audit: AuditLog = {
      id: this.idGen.generatePrefixedId('aud'),
      companyId: currentCompId,
      actor: opName,
      action: type,
      resource: 'Caixa',
      resourceId: mov.id,
      details: `${type === 'SUPRIMENTO' ? 'Entrada/Suprimento' : 'Retirada/Sangria'} de R$ ${amount.toFixed(2)}: ${reason}`,
      timestamp: Date.now()
    };
    await db.auditLogs.put(audit);
    await this.syncOutbox.enqueue('CASH_MOVEMENT', mov.id, 'CREATE', mov);
    });
  }

  /**
   * Adjusts stock for a product atomically.
   */
  async adjustStock(productId: string, type: 'ENTRADA' | 'SAIDA', quantity: number, reason: string): Promise<void> {
    this.osContext.permissions.assertPermission('STOCK_ADJUST', 'estoque');

    const currentCompId = this.context.companyId();
    const currentOp = this.context.currentOperator();

    if (!currentCompId) {
      throw new Error('Operação bloqueada: Terminal não configurado.');
    }
    const opName = currentOp ? currentOp.name : 'Sistema';

    await db.transaction('rw', [db.products, db.stockMovements, db.auditLogs, db.outbox], async () => {
      const product = await db.products.get(productId);
      if (!product) throw new Error('Produto não encontrado.');

      const prevStock = product.stock;
      const newStock = type === 'ENTRADA' ? prevStock + quantity : prevStock - quantity;

      product.stock = newStock;
      product.updatedAt = Date.now();
      await db.products.put(product);

      const mov: StockMovement = {
        id: this.idGen.generatePrefixedId('mov-stk'),
        companyId: currentCompId,
        productId: product.id,
        productName: product.name,
        type: type === 'ENTRADA' ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO',
        quantity,
        previousStock: prevStock,
        newStock,
        reason,
        operatorName: opName,
        timestamp: Date.now()
      };
      await db.stockMovements.put(mov);

      const audit: AuditLog = {
        id: this.idGen.generatePrefixedId('aud'),
        companyId: currentCompId,
        actor: opName,
        action: type === 'ENTRADA' ? 'AJUSTE_ESTOQUE_ENTRADA' : 'AJUSTE_ESTOQUE_SAIDA',
        resource: 'Estoque',
        resourceId: product.id,
        details: `Ajuste manual de estoque. Produto: ${product.name}, Quantidade: ${quantity}, Motivo: ${reason}`,
        timestamp: Date.now()
      };
      await db.auditLogs.put(audit);
      await this.syncOutbox.enqueue('STOCK_MOVEMENT', mov.id, 'CREATE', mov);
    });
  }

  /**
   * Closes the active cash session.
   */
  async closeActiveCashSession(declaredCash: number, denominationCounts?: CashDenominationCount): Promise<CashSession> {
    this.osContext.permissions.assertPermission('CLOSE_CASH', 'caixa');

    const currentCompId = this.context.companyId();
    const currentLocId = this.context.locationId();
    const currentOp = this.context.currentOperator();

    if (!currentCompId) {
      throw new Error('Operação bloqueada: Terminal não configurado.');
    }

    if (!currentOp) {
      throw new Error('Operação bloqueada: É necessário estar autenticado para fechar o caixa.');
    }

    const activeSession = await db.cashSessions
      .filter(s => s.status === 'OPEN' && s.companyId === currentCompId && (!currentLocId || s.locationId === currentLocId))
      .first();
    if (!activeSession) {
      throw new Error('Nenhum turno aberto para fechar.');
    }

    const opName = currentOp.name;

    let calculated = activeSession.initialCash;
    for (const mov of activeSession.movements) {
      if (mov.type === 'ABERTURA' || mov.type === 'SUPRIMENTO' || mov.type === 'VENDA' || mov.type === 'PAGAMENTO_FIADO') {
        calculated += mov.amount;
      } else if (mov.type === 'SANGRIA') {
        calculated -= mov.amount;
      }
    }

    const difference = declaredCash - calculated;

    await db.transaction('rw', [db.cashSessions, db.auditLogs, db.outbox], async () => {
      activeSession.status = 'CLOSED';
    activeSession.closedAt = Date.now();
    activeSession.finalCashCalculated = calculated;
    activeSession.finalCashDeclared = declaredCash;
    activeSession.cashDifference = difference;
    activeSession.denominationCounts = denominationCounts;

    await db.cashSessions.put(activeSession);

    const audit: AuditLog = {
      id: this.idGen.generatePrefixedId('aud'),
      companyId: currentCompId,
      actor: opName,
      action: 'FECHAMENTO_CAIXA',
      resource: 'Caixa',
      resourceId: activeSession.id,
      details: `Caixa fechado. Calculado: R$ ${calculated.toFixed(2)}, Declarado: R$ ${declaredCash.toFixed(2)}, Dif: R$ ${difference.toFixed(2)}`,
      timestamp: Date.now()
    };
    await db.auditLogs.put(audit);
    await this.syncOutbox.enqueue('CASH_SESSION', activeSession.id, 'UPDATE', activeSession);
    });

    return activeSession;
  }

  /**
   * Opens a new cash session.
   */
  async openCashSession(initialCash: number): Promise<CashSession> {
    this.osContext.permissions.assertPermission('OPEN_CASH', 'caixa');

    const currentCompId = this.context.companyId();
    const currentLocId = this.context.locationId();
    const currentOp = this.context.currentOperator();

    if (!currentCompId || !currentLocId) {
      throw new Error('Operação bloqueada: O terminal operacional precisa estar configurado para abrir turnos de caixa.');
    }

    if (!currentOp) {
      throw new Error('Operação bloqueada: É necessário um operador autenticado e ativo para abrir o caixa.');
    }

    const activeSession = await db.cashSessions
      .filter(s => s.status === 'OPEN' && s.companyId === currentCompId && (!currentLocId || s.locationId === currentLocId))
      .first();
    if (activeSession) {
      throw new Error('Já existe um turno de caixa aberto. Feche o anterior primeiro.');
    }

    const opName = currentOp.name;
    const opId = currentOp.id;

    const sessionId = this.idGen.generatePrefixedId('session');
    let newSession!: CashSession;
    await db.transaction('rw', [db.cashSessions, db.auditLogs, db.outbox], async () => {
    newSession = {
      id: sessionId,
      companyId: currentCompId,
      locationId: currentLocId,
      operatorId: opId,
      operatorName: opName,
      initialCash,
      status: 'OPEN',
      openedAt: Date.now(),
      movements: [
        {
          id: this.idGen.generatePrefixedId('mov-abertura'),
          sessionId,
          type: 'ABERTURA',
          amount: initialCash,
          reason: 'Fundo de troco de abertura',
          operatorName: opName,
          timestamp: Date.now()
        }
      ]
    };

    await db.cashSessions.put(newSession);

    const audit: AuditLog = {
      id: this.idGen.generatePrefixedId('aud'),
      companyId: currentCompId,
      actor: opName,
      action: 'ABERTURA_CAIXA',
      resource: 'Caixa',
      resourceId: newSession.id,
      details: `Turno de caixa aberto com fundo inicial de R$ ${initialCash.toFixed(2)}`,
      timestamp: Date.now()
    };
    await db.auditLogs.put(audit);
    await this.syncOutbox.enqueue('CASH_SESSION', newSession.id, 'CREATE', newSession);
    });

    return newSession;
  }

  /**
   * Customer debt liquidation (Pagamento de Fiado)
   */
  async payCustomerDebt(customerId: string, amount: number, paymentMethod: string): Promise<void> {
    this.osContext.permissions.assertPermission('RECEIVE_DEBT', 'clientes');

    const customer = await db.customers.get(customerId);
    if (!customer) throw new Error('Cliente não encontrado.');

    const currentCompId = this.context.companyId();
    const currentLocId = this.context.locationId();
    const currentOp = this.context.currentOperator();

    if (!currentCompId) {
      throw new Error('Operação bloqueada: Terminal não configurado.');
    }

    if (!currentOp) {
      throw new Error('Operação bloqueada: É necessário um operador autenticado para liquidar fiados.');
    }

    const opName = currentOp.name;

    await db.transaction('rw', [db.customers, db.cashSessions, db.auditLogs, db.outbox], async () => {
    customer.currentDebt = Math.max(0, (customer.currentDebt || 0) - amount);
    customer.updatedAt = Date.now();
    await db.customers.put(customer);

    // If paid in cash, add to active cash session
    if (paymentMethod === 'dinheiro') {
      const activeSession = await db.cashSessions
        .filter(s => s.status === 'OPEN' && s.companyId === currentCompId && (!currentLocId || s.locationId === currentLocId))
        .first();
      if (activeSession) {
        const mov: CashMovement = {
          id: this.idGen.generatePrefixedId('mov-fiado'),
          sessionId: activeSession.id,
          type: 'PAGAMENTO_FIADO',
          amount,
          reason: `Recebimento Fiado - ${customer.name}`,
          operatorName: opName,
          timestamp: Date.now()
        };
        activeSession.movements.push(mov);
        await db.cashSessions.put(activeSession);
      }
    }

    const audit: AuditLog = {
      id: this.idGen.generatePrefixedId('aud'),
      companyId: currentCompId,
      actor: opName,
      action: 'RECEBIMENTO_FIADO',
      resource: 'Clientes',
      resourceId: customer.id,
      details: `Recebimento de R$ ${amount.toFixed(2)} (${paymentMethod}) para ${customer.name}. Saldo devedor restante: R$ ${customer.currentDebt.toFixed(2)}`,
      timestamp: Date.now()
    };
    await db.auditLogs.put(audit);
    await this.syncOutbox.enqueue('CUSTOMER', customer.id, 'UPDATE', customer);
    });
  }

  async saveProduct(product: Product, operation: 'CREATE' | 'UPDATE'): Promise<Product> {
    this.osContext.permissions.assertPermission('PRODUCT_SAVE', 'estoque');
    return this._saveEntity('products', product, operation);
  }

  async saveOperator(operator: Operator, operation: 'CREATE' | 'UPDATE'): Promise<Operator> {
    this.osContext.permissions.assertPermission('OPERATOR_SAVE', 'funcionarios');
    return this._saveEntity('operators', operator, operation);
  }

  async deleteOperator(id: string): Promise<void> {
    this.osContext.permissions.assertPermission('OPERATOR_DELETE', 'funcionarios');
    return this._deleteEntity('operators', id);
  }

  async saveCustomer(customer: Customer, operation: 'CREATE' | 'UPDATE'): Promise<Customer> {
    this.osContext.permissions.assertPermission('CUSTOMER_SAVE', 'clientes');
    return this._saveEntity('customers', customer, operation);
  }

  /**
   * Completes a purchase order receipt atomically across inventory, kardex, finance and outbox.
   */
  async processPurchaseReceipt(purchaseOrderId: string): Promise<PurchaseOrder> {
    this.osContext.permissions.assertPermission('PURCHASE_RECEIVE', 'compras');

    const currentCompId = this.context.companyId();
    if (!currentCompId) {
      throw new Error('Operação bloqueada: Terminal operacional não configurado.');
    }

    const currentOp = this.context.currentOperator();
    const opName = currentOp ? currentOp.name : (this.context.operatorName() || 'Administrador');
    const now = Date.now();

    let updatedPo!: PurchaseOrder;

    await db.transaction('rw', [db.purchaseOrders, db.products, db.stockMovements, db.financialTransactions, db.auditLogs, db.outbox], async () => {
      const po = await db.purchaseOrders.get(purchaseOrderId);
      if (!po) {
        throw new Error(`Operação bloqueada: Pedido de compra #${purchaseOrderId} não encontrado.`);
      }

      if (po.status === 'RECEBIDO') {
        throw new Error(`Operação bloqueada: O pedido de compra #${po.id.substring(3, 9)} já foi recebido e liquidado anteriormente.`);
      }

      // 1. Atualizar estoque físico e kardex para cada item do pedido
      for (const item of po.items) {
        const prod = await db.products.get(item.productId);
        if (prod) {
          const prev = prod.stock;
          const next = prev + item.quantity;
          const updatedProd: Product = {
            ...prod,
            stock: next,
            costPrice: item.unitCost || prod.costPrice,
            updatedAt: now
          };
          await db.products.put(updatedProd);
          await this.syncOutbox.enqueue('PRODUCT', prod.id, 'UPDATE', updatedProd);

          const mov: StockMovement = {
            id: this.idGen.generatePrefixedId('mov-stk'),
            companyId: currentCompId,
            productId: prod.id,
            productName: prod.name,
            type: 'ENTRADA',
            quantity: item.quantity,
            previousStock: prev,
            newStock: next,
            reason: `Recebimento Pedido #${po.id.substring(3, 9)} (${po.supplierName})`,
            operatorName: opName,
            timestamp: now
          };
          await db.stockMovements.put(mov);
          await this.syncOutbox.enqueue('STOCK_MOVEMENT', mov.id, 'CREATE', mov);
        }
      }

      // 2. Lança a conta a pagar (despesa) no financeiro de forma atômica
      const finTx: FinancialTransaction = {
        id: this.idGen.generatePrefixedId('fin'),
        companyId: currentCompId,
        type: 'DESPESA',
        category: 'Fornecedores',
        description: `Pgto Pedido #${po.id.substring(3, 9)} - ${po.supplierName}`,
        amount: po.total,
        status: 'PENDENTE',
        dueDate: now + 86400000 * 30,
        paymentMethod: 'Boleto'
      };
      await db.financialTransactions.put(finTx);
      await this.syncOutbox.enqueue('FINANCIAL_TRANSACTION', finTx.id, 'CREATE', finTx);

      // 3. Atualizar status do pedido de compra
      updatedPo = { ...po, status: 'RECEBIDO' };
      await db.purchaseOrders.put(updatedPo);
      await this.syncOutbox.enqueue('PURCHASE_ORDER', updatedPo.id, 'UPDATE', updatedPo);

      // 4. Log de auditoria
      const audit: AuditLog = {
        id: this.idGen.generatePrefixedId('aud'),
        companyId: currentCompId,
        actor: opName,
        action: 'RECEBIMENTO_PEDIDO_COMPRA',
        resource: 'COMPRAS',
        resourceId: po.id,
        details: `Recebimento total do pedido #${po.id.substring(3, 9)} no valor de R$ ${po.total.toFixed(2)} (${po.supplierName})`,
        timestamp: now
      };
      await db.auditLogs.put(audit);
    });

    return updatedPo;
  }

  /**
   * Finalizes a manufacturing order atomically: validates insumos, deducts ingredients, increments finished product stock, and logs movements.
   */
  async finalizeManufacturingOrder(orderId: string): Promise<ManufacturingOrder> {
    this.osContext.permissions.assertPermission('MFG_FINALIZE', 'fabricacao');

    const currentCompId = this.context.companyId();
    if (!currentCompId) {
      throw new Error('Operação bloqueada: Terminal operacional não configurado.');
    }

    const currentOp = this.context.currentOperator();
    const opName = currentOp ? currentOp.name : (this.context.operatorName() || 'Administrador');
    const now = Date.now();

    let updatedOf!: ManufacturingOrder;

    await db.transaction('rw', [db.manufacturingOrders, db.products, db.stockMovements, db.auditLogs, db.outbox], async () => {
      const of = await db.manufacturingOrders.get(orderId);
      if (!of) {
        throw new Error(`Operação bloqueada: Ordem de Fabricação #${orderId} não encontrada.`);
      }

      if (of.status === 'CONCLUIDO') {
        throw new Error(`Operação bloqueada: A ordem de fabricação #${of.id.substring(3, 8)} já foi concluída.`);
      }

      // 1. Validar e preparar consumo de insumos
      const insumosToSave: { prod: Product; qtyToDeduct: number; prevStock: number; newStock: number }[] = [];
      for (const comp of of.components) {
        let insumo: Product | undefined;
        if (comp.productId) {
          insumo = await db.products.get(comp.productId);
        }
        if (!insumo) {
          insumo = await db.products.where('companyId').equals(currentCompId).and(p => p.name === comp.name).first();
        }
        if (!insumo) {
          throw new Error(`Operação cancelada: O insumo obrigatório "${comp.name}" não está cadastrado no banco de produtos.`);
        }

        const prevStock = insumo.stock;
        const qtyToDeduct = comp.qtyRequired * of.quantity;
        const newStock = prevStock - qtyToDeduct;
        const allowNegative = insumo.allowNegativeStock ?? false;

        if (newStock < 0 && !allowNegative) {
          throw new Error(`Operação cancelada: Estoque insuficiente para o insumo "${insumo.name}". Disponível: ${prevStock}, Necessário: ${qtyToDeduct}`);
        }

        insumosToSave.push({ prod: insumo, qtyToDeduct, prevStock, newStock });
      }

      // 2. Aplicar deduções de estoque e gravar movimentos de Kardex
      for (const item of insumosToSave) {
        const updatedInsumo: Product = { ...item.prod, stock: item.newStock, updatedAt: now };
        await db.products.put(updatedInsumo);
        await this.syncOutbox.enqueue('PRODUCT', updatedInsumo.id, 'UPDATE', updatedInsumo);

        const mov: StockMovement = {
          id: this.idGen.generatePrefixedId('mov-stk'),
          companyId: currentCompId,
          productId: item.prod.id,
          productName: item.prod.name,
          type: 'AJUSTE_NEGATIVO',
          quantity: item.qtyToDeduct,
          previousStock: item.prevStock,
          newStock: item.newStock,
          reason: `Baixa de Produção OF #${of.id.substring(3, 8)}`,
          operatorName: opName,
          timestamp: now
        };
        await db.stockMovements.put(mov);
        await this.syncOutbox.enqueue('STOCK_MOVEMENT', mov.id, 'CREATE', mov);
      }

      // 3. Atualizar ou criar produto final fabricado
      let finalProduct = await db.products.where('companyId').equals(currentCompId).and(p => p.name === of.productName).first();
      if (!finalProduct) {
        const finalProdId = this.idGen.generatePrefixedId('prod');
        finalProduct = {
          id: finalProdId,
          companyId: currentCompId,
          name: of.productName,
          category: 'Produção Própria',
          barcode: '',
          price: 25.00,
          costPrice: 8.50,
          stock: 0,
          minStock: 5,
          unit: 'un',
          icon: 'lunch_dining',
          active: true,
          createdAt: now,
          updatedAt: now
        };
        await db.products.put(finalProduct);
        await this.syncOutbox.enqueue('PRODUCT', finalProduct.id, 'CREATE', finalProduct);
      }

      const prevFinalStock = finalProduct.stock;
      const newFinalStock = prevFinalStock + of.quantity;
      const updatedFinalProduct: Product = { ...finalProduct, stock: newFinalStock, updatedAt: now };
      await db.products.put(updatedFinalProduct);
      await this.syncOutbox.enqueue('PRODUCT', updatedFinalProduct.id, 'UPDATE', updatedFinalProduct);

      const finalMov: StockMovement = {
        id: this.idGen.generatePrefixedId('mov-stk'),
        companyId: currentCompId,
        productId: finalProduct.id,
        productName: finalProduct.name,
        type: 'ENTRADA',
        quantity: of.quantity,
        previousStock: prevFinalStock,
        newStock: newFinalStock,
        reason: `Lote fabricado OF #${of.id.substring(3, 8)}`,
        operatorName: opName,
        timestamp: now
      };
      await db.stockMovements.put(finalMov);
      await this.syncOutbox.enqueue('STOCK_MOVEMENT', finalMov.id, 'CREATE', finalMov);

      // 4. Atualizar status da OF
      updatedOf = { ...of, status: 'CONCLUIDO' };
      await db.manufacturingOrders.put(updatedOf);
      await this.syncOutbox.enqueue('MANUFACTURING_ORDER', updatedOf.id, 'UPDATE', updatedOf);

      // 5. Auditoria
      const audit: AuditLog = {
        id: this.idGen.generatePrefixedId('aud'),
        companyId: currentCompId,
        actor: opName,
        action: 'CONCLUSAO_ORDEM_FABRICACAO',
        resource: 'FABRICACAO',
        resourceId: of.id,
        details: `OF #${of.id.substring(3, 8)} concluída: +${of.quantity} ${of.productName}`,
        timestamp: now
      };
      await db.auditLogs.put(audit);
    });

    return updatedOf;
  }

  /**
   * Public exposure of saveEntity to allow safe atomic writes with RBAC assertion, audit logs and standard outbox queue across all business modules.
   */
  async saveEntity<T extends { id: string }>(tableName: string, entity: T, operation: 'CREATE' | 'UPDATE' | 'DELETE' = 'CREATE'): Promise<T> {
    if (operation === 'DELETE') {
      await this._deleteEntity(tableName, entity.id);
      return entity;
    }
    return this._saveEntity(tableName, entity, operation);
  }

  /**
   * Public exposure of deleteEntity to allow safe atomic deletions with RBAC assertion, audit logs and standard outbox queue across all business modules.
   */
  async deleteEntity(tableName: string, id: string): Promise<void> {
    return this._deleteEntity(tableName, id);
  }

  /**
   * Universal method to save an entity atomically in a Dexie transaction, enforce tenant isolation, assert RBAC permissions, and enqueue it to the sync Outbox.
   */
  private async _saveEntity<T extends { id: string }>(tableName: string, entity: T, operation: 'CREATE' | 'UPDATE'): Promise<T> {
    const table = (db as any)[tableName];
    if (!table) {
      throw new Error(`Tabela "${tableName}" não existe no Dexie.`);
    }

    // RBAC Permission Assertion
    const perm = TABLE_TO_PERMISSION[tableName];
    if (perm) {
      this.osContext.permissions.assertPermission(perm.action, perm.resource);
    }

    const currentCompId = this.context.companyId() || 'SYS';
    const currentOp = this.context.currentOperator();
    const opName = currentOp ? currentOp.name : 'Sistema';

    // Ensure tenant assignment (P0 FIX)
    if (currentCompId && currentCompId !== 'SYS') {
      (entity as any).companyId = currentCompId;
    }

    const standardEntityType = getEntityTypeForTable(tableName);

    await db.transaction('rw', [table, db.auditLogs, db.outbox], async () => {
      await table.put(entity);
      
      const audit: AuditLog = {
        id: this.idGen.generatePrefixedId('aud'),
        companyId: currentCompId,
        actor: opName,
        action: operation === 'CREATE' ? 'CRIACAO_REGISTRO' : 'ATUALIZACAO_REGISTRO',
        resource: standardEntityType,
        resourceId: entity.id,
        details: `Registro ${entity.id} salvo em ${tableName}`,
        timestamp: Date.now()
      };
      await db.auditLogs.put(audit);
      await this.syncOutbox.enqueue(standardEntityType, entity.id, operation, entity, currentOp?.id);
    });
    return entity;
  }

  /**
   * Universal method to delete an entity atomically in a Dexie transaction, assert RBAC permissions, and enqueue its deletion to the sync Outbox.
   */
  private async _deleteEntity(tableName: string, id: string): Promise<void> {
    const table = (db as any)[tableName];
    if (!table) {
      throw new Error(`Tabela "${tableName}" não existe no Dexie.`);
    }

    // RBAC Permission Assertion
    const perm = TABLE_TO_PERMISSION[tableName];
    if (perm) {
      this.osContext.permissions.assertPermission(perm.action, perm.resource);
    }

    const currentCompId = this.context.companyId() || 'SYS';
    const currentOp = this.context.currentOperator();
    const opName = currentOp ? currentOp.name : 'Sistema';
    const standardEntityType = getEntityTypeForTable(tableName);

    await db.transaction('rw', [table, db.auditLogs, db.outbox], async () => {
      await table.delete(id);

      const audit: AuditLog = {
        id: this.idGen.generatePrefixedId('aud'),
        companyId: currentCompId,
        actor: opName,
        action: 'EXCLUSAO_REGISTRO',
        resource: standardEntityType,
        resourceId: id,
        details: `Registro ${id} excluído de ${tableName}`,
        timestamp: Date.now()
      };
      await db.auditLogs.put(audit);
      await this.syncOutbox.enqueue(standardEntityType, id, 'DELETE', { id }, currentOp?.id);
    });
  }
}
