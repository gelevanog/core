/**
 * JSON DSL Type Definitions
 * 
 * Формат функций: { type: "CALLBACK", config: { debug?: boolean, ...params } }
 * Внутренние выражения и statements — упрощённый формат с полными названиями свойств
 */

// ============ Expressions ============

/** Литерал: { literal: value } */
export interface LiteralExpr {
  literal: string | number | boolean | null;
}

/** Ссылка на переменную: { ref: "name" } */
export interface RefExpr {
  ref: string;
}

/** Доступ к свойству: { object: expr, property: "name" } */
export interface MemberExpr {
  object: Expression;
  property: string;
}

/** Доступ по индексу: { object: expr, index: expr } */
export interface IndexExpr {
  object: Expression;
  index: Expression;
}

/** Бинарная операция: { operator: "+", left: expr, right: expr } */
export interface BinaryExpr {
  operator: BinaryOperator;
  left: Expression;
  right: Expression;
}

/** Унарная операция: { operator: "!", argument: expr } */
export interface UnaryExpr {
  operator: UnaryOperator;
  argument: Expression;
}

/** Вызов функции: { call: "fnName", arguments: [...] } */
export interface CallExpr {
  call: string;
  arguments?: Expression[];
}

/** Вызов метода: { method: "name", object: expr, arguments: [...] } */
export interface MethodExpr {
  method: string;
  object: Expression;
  arguments?: Expression[];
}

/** Тернарный оператор: { condition: expr, then: expr, else: expr } */
export interface TernaryExpr {
  condition: Expression;
  then: Expression;
  else: Expression;
}

/** Объект: { properties: { key: expr, ... } } */
export interface ObjectExpr {
  properties: Record<string, Expression>;
}

/** Массив: { elements: [...] } */
export interface ArrayExpr {
  elements: Expression[];
}

export type Expression =
  | LiteralExpr
  | RefExpr
  | MemberExpr
  | IndexExpr
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | MethodExpr
  | TernaryExpr
  | ObjectExpr
  | ArrayExpr
  | string   // shorthand для ref
  | number   // shorthand для literal
  | boolean; // shorthand для literal

// ============ Statements ============

/** Объявление переменной: { let: "name", value: expr } */
export interface LetStmt {
  let: string;
  value: Expression;
}

/** Присваивание: { set: "name", value: expr } */
export interface SetStmt {
  set: string;
  value: Expression;
}

/** Условие: { if: expr, then: [...], else?: [...] } */
export interface IfStmt {
  if: Expression;
  then: Statement[];
  else?: Statement[];
}

/** Цикл for: { for: "item", in: expr, do: [...] } */
export interface ForStmt {
  for: string;
  in: Expression;
  do: Statement[];
}

/** Цикл while: { while: expr, do: [...] } */
export interface WhileStmt {
  while: Expression;
  do: Statement[];
}

/** Return: { return: expr } */
export interface ReturnStmt {
  return: Expression;
}

export type Statement =
  | LetStmt
  | SetStmt
  | IfStmt
  | ForStmt
  | WhileStmt
  | ReturnStmt;

// ============ Operators ============

export type BinaryOperator =
  | '+' | '-' | '*' | '/' | '%'
  | '==' | '===' | '!=' | '!=='
  | '<' | '<=' | '>' | '>='
  | '&&' | '||'
  | '&' | '|' | '^';

export type UnaryOperator = '!' | '-' | '+' | '~';

// ============ Function Definition ============

export interface ParamDef {
  name: string;
  type?: string;
  required?: boolean;
  default?: unknown;
}

export interface FunctionConfig {
  debug?: boolean;
  name?: string;
  description?: string;
  params: string[] | ParamDef[];
  body: Statement[];
  return?: Expression;
}

export interface FunctionDef {
  type: 'CALLBACK';
  config: FunctionConfig;
}

// ============ Config ============

export interface DslConfig {
  $schema?: string;
  functions: Record<string, FunctionDef>;
}

// ============ Runtime ============

export interface FunctionInfo {
  name: string;
  description: string;
  params: string[];
}

export interface ReturnValue {
  __return__: true;
  value: unknown;
}

export type BuiltinFn = (...args: unknown[]) => unknown;

export type Scope = Map<string, unknown>;
