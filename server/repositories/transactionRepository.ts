import { dbQuery } from '../db';

export interface TransactionRecord {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  status: string;
  failure_code?: string;
  failure_reason?: string;
  created_at: string;
}

export const TransactionRepository = {
  async save(tx: TransactionRecord): Promise<void> {
    await dbQuery.run(
      `INSERT OR REPLACE INTO transactions (
        id, order_id, amount, currency, customer_name, customer_email, customer_phone, status, failure_code, failure_reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tx.id,
        tx.order_id,
        tx.amount,
        tx.currency,
        tx.customer_name,
        tx.customer_email,
        tx.customer_phone,
        tx.status,
        tx.failure_code || null,
        tx.failure_reason || null,
        tx.created_at
      ]
    );
  },

  async findById(id: string): Promise<TransactionRecord | undefined> {
    return dbQuery.get<TransactionRecord>(
      `SELECT * FROM transactions WHERE id = ?`,
      [id]
    );
  },

  async findByOrderId(orderId: string): Promise<TransactionRecord | undefined> {
    return dbQuery.get<TransactionRecord>(
      `SELECT * FROM transactions WHERE order_id = ?`,
      [orderId]
    );
  },

  async updateStatus(
    id: string,
    status: string,
    failureCode?: string,
    failureReason?: string
  ): Promise<void> {
    await dbQuery.run(
      `UPDATE transactions SET status = ?, failure_code = COALESCE(?, failure_code), failure_reason = COALESCE(?, failure_reason) WHERE id = ?`,
      [status, failureCode || null, failureReason || null, id]
    );
  }
};
