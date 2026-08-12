-- ============================================================================
-- Migration: Linea de credito y Dispersion de linea de credito
-- ============================================================================
-- Additive, safe for existing data:
--   * account_type:                 'credit_line'  (Linea de credito)
--   * money_movement_kind:          'credit_line_disbursement' (Dispersion de linea de credito)
--
-- NOTES:
--   * ALTER TYPE ... ADD VALUE cannot run inside a transaction block alongside
--     usage of the new value, so each statement is executed on its own.
--   * Both are additive; existing rows and data are unaffected.
-- ============================================================================

ALTER TYPE public.account_type ADD VALUE IF NOT EXISTS 'credit_line';

ALTER TYPE public.money_movement_kind ADD VALUE IF NOT EXISTS 'credit_line_disbursement';
