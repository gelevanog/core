/**
 * JSON DSL Compiler - компилирует JSON-конфигурации в реальные JS-функции
 * 
 * Формат функций: { type: "FUNCTION", config: { debug?: boolean, ...params } }
 * Внутренние выражения и statements — упрощённый формат с полными названиями свойств
 */

import type {
  DslConfig,
  FunctionDef,
  FunctionInfo,
  Statement,
  Expression,
  ReturnValue,
  BuiltinFn,
  Scope,
  BinaryOperator,
  UnaryOperator,
  LetStmt,
  SetStmt,
  IfStmt,
  ForStmt,
  WhileStmt,
  ReturnStmt,
  LiteralExpr,
  RefExpr,
  MemberExpr,
  IndexExpr,
  BinaryExpr,
  UnaryExpr,
  CallExpr,
  MethodExpr,
  TernaryExpr,
  ObjectExpr,
  ArrayExpr,
} from './types';

/** Скомпилированная функция */
export type CompiledFunction<TArgs extends unknown[] = unknown[], TReturn = unknown> = 
  (...args: TArgs) => TReturn;

/** Контекст выполнения функции */
export interface ExecutionContext {
  /** Дополнительные переменные, доступные в функции */
  variables?: Record<string, unknown>;
  /** Дополнительные функции, доступные для вызова */
  functions?: Record<string, CompiledFunction>;
  /** Кастомные builtins */
  builtins?: Record<string, BuiltinFn>;
  /** Callback при вызове функции */
  onCall?: (fnName: string, args: unknown[]) => void;
  /** Callback при return */
  onReturn?: (fnName: string, result: unknown) => void;
}

export class JsonDslCompiler {
  private functionDefs: Map<string, FunctionDef> = new Map();
  private compiledFunctions: Map<string, CompiledFunction> = new Map();
  private builtins: Record<string, BuiltinFn>;
  private allowedMethods: Set<string>;
  private debugMode = false;

  constructor() {
    this.builtins = this.createBuiltins();
    this.allowedMethods = new Set([
      'length', 'push', 'pop', 'shift', 'unshift', 'slice', 'concat',
      'indexOf', 'includes', 'find', 'filter', 'map', 'reduce',
      'join', 'split', 'trim', 'toLowerCase', 'toUpperCase',
      'substring', 'charAt', 'startsWith', 'endsWith',
      'keys', 'values', 'entries', 'hasOwnProperty',
      'toString', 'toFixed',
    ]);
  }

  /**
   * Загрузка конфигурации из JSON
   */
  load(config: DslConfig): this {
    if (!config || !config.functions) {
      throw new Error('Invalid config: missing "functions" property');
    }

    for (const [name, def] of Object.entries(config.functions)) {
      this.validateFunction(name, def);
      this.functionDefs.set(name, def);
    }

    return this;
  }

  /**
   * Компилирует функцию и возвращает её (без выполнения)
   */
  compile<TArgs extends unknown[] = unknown[], TReturn = unknown>(
    fnName: string,
    context?: ExecutionContext
  ): CompiledFunction<TArgs, TReturn> {
    const def = this.functionDefs.get(fnName);
    if (!def) {
      throw new Error(`Function "${fnName}" not found`);
    }

    const params = this.normalizeParams(def.config.params);

    // Создаём замыкание с захваченным контекстом
    const compiledFn = (...args: TArgs): TReturn => {
      // Создаём scope с параметрами
      const scope: Scope = new Map();
      
      // Добавляем переменные из контекста
      if (context?.variables) {
        for (const [key, value] of Object.entries(context.variables)) {
          scope.set(key, value);
        }
      }

      // Добавляем параметры функции
      params.forEach((param, i) => {
        scope.set(param, args[i]);
      });

      // Callback при вызове
      context?.onCall?.(fnName, args as unknown[]);

      // Debug mode
      if (def.config.debug) {
        console.log(`[DEBUG] ${fnName} called with:`, args);
      }

      // Выполняем тело функции
      const result = this.executeBlock(def.config.body, scope, context);

      let returnValue: unknown;

      // Если был return в body — возвращаем его
      if (result && (result as ReturnValue).__return__) {
        returnValue = (result as ReturnValue).value;
      } else if (def.config.return) {
        // Иначе вычисляем return expression
        returnValue = this.evalExpr(def.config.return, scope, context);
      }

      // Debug mode
      if (def.config.debug) {
        console.log(`[DEBUG] ${fnName} returned:`, returnValue);
      }

      // Callback при return
      context?.onReturn?.(fnName, returnValue);

      return returnValue as TReturn;
    };

    // Кэшируем скомпилированную функцию
    this.compiledFunctions.set(fnName, compiledFn as CompiledFunction);

    return compiledFn;
  }

  /**
   * Компилирует все функции и возвращает объект с ними
   */
  compileAll<T extends Record<string, CompiledFunction> = Record<string, CompiledFunction>>(
    context?: ExecutionContext
  ): T {
    const result: Record<string, CompiledFunction> = {};

    for (const name of this.functionDefs.keys()) {
      result[name] = this.compile(name, context);
    }

    return result as T;
  }

  /**
   * Получить скомпилированную функцию (если уже скомпилирована)
   */
  get<TArgs extends unknown[] = unknown[], TReturn = unknown>(
    fnName: string
  ): CompiledFunction<TArgs, TReturn> | undefined {
    return this.compiledFunctions.get(fnName) as CompiledFunction<TArgs, TReturn> | undefined;
  }

  /**
   * Получить список функций
   */
  listFunctions(): FunctionInfo[] {
    const list: FunctionInfo[] = [];
    for (const [name, def] of this.functionDefs) {
      list.push({
        name,
        description: def.config.description || '',
        params: this.normalizeParams(def.config.params),
      });
    }
    return list;
  }

  /**
   * Добавить встроенную функцию
   */
  addBuiltin(name: string, fn: BuiltinFn): this {
    this.builtins[name] = fn;
    return this;
  }

  // ============ PRIVATE METHODS ============

  private createBuiltins(): Record<string, BuiltinFn> {
    return {
      abs: (x: unknown) => Math.abs(x as number),
      floor: (x: unknown) => Math.floor(x as number),
      ceil: (x: unknown) => Math.ceil(x as number),
      round: (x: unknown) => Math.round(x as number),
      min: (...args: unknown[]) => Math.min(...(args as number[])),
      max: (...args: unknown[]) => Math.max(...(args as number[])),
      pow: (x: unknown, y: unknown) => Math.pow(x as number, y as number),
      sqrt: (x: unknown) => Math.sqrt(x as number),
      random: () => Math.random(),
      len: (x: unknown) => (Array.isArray(x) || typeof x === 'string') ? x.length : 0,
      keys: (obj: unknown) => Object.keys((obj as object) || {}),
      values: (obj: unknown) => Object.values((obj as object) || {}),
      entries: (obj: unknown) => Object.entries((obj as object) || {}),
      isArray: (x: unknown) => Array.isArray(x),
      isNumber: (x: unknown) => typeof x === 'number',
      isString: (x: unknown) => typeof x === 'string',
      isObject: (x: unknown) => x !== null && typeof x === 'object' && !Array.isArray(x),
      isNull: (x: unknown) => x === null || x === undefined,
      toNumber: (x: unknown) => Number(x),
      toString: (x: unknown) => String(x),
      toJson: (x: unknown) => JSON.stringify(x),
      fromJson: (x: unknown) => JSON.parse(x as string),
      log: (...args: unknown[]) => console.log('[DSL]', ...args),
    };
  }

  private normalizeParams(params: string[] | { name: string }[]): string[] {
    if (!params || params.length === 0) return [];
    if (typeof params[0] === 'string') {
      return params as string[];
    }
    return (params as { name: string }[]).map((p) => p.name);
  }

  private validateFunction(name: string, def: FunctionDef): void {
    if (def.type !== 'FUNCTION') {
      throw new Error(`Function "${name}": type must be "FUNCTION"`);
    }
    if (!def.config) {
      throw new Error(`Function "${name}": config is required`);
    }
    if (!def.config.params || !Array.isArray(def.config.params)) {
      throw new Error(`Function "${name}": config.params must be an array`);
    }
    if (!def.config.body || !Array.isArray(def.config.body)) {
      throw new Error(`Function "${name}": config.body must be an array`);
    }
  }

  private executeBlock(
    statements: Statement[],
    scope: Scope,
    context?: ExecutionContext
  ): ReturnValue | null {
    for (const stmt of statements) {
      const result = this.executeStmt(stmt, scope, context);
      if (result && result.__return__) {
        return result;
      }
    }
    return null;
  }

  private executeStmt(
    stmt: Statement,
    scope: Scope,
    context?: ExecutionContext
  ): ReturnValue | null {
    // LET: { let: "name", value: expr }
    if ('let' in stmt) {
      const s = stmt as LetStmt;
      const value = this.evalExpr(s.value, scope, context);
      scope.set(s.let, value);
      return null;
    }

    // SET: { set: "name", value: expr }
    if ('set' in stmt) {
      const s = stmt as SetStmt;
      if (!scope.has(s.set)) {
        throw new Error(`Variable "${s.set}" is not defined`);
      }
      const value = this.evalExpr(s.value, scope, context);
      scope.set(s.set, value);
      return null;
    }

    // IF: { if: expr, then: [...], else?: [...] }
    if ('if' in stmt) {
      const s = stmt as IfStmt;
      const cond = this.evalExpr(s.if, scope, context);
      if (cond) {
        return this.executeBlock(s.then || [], scope, context);
      } else if (s.else) {
        return this.executeBlock(s.else, scope, context);
      }
      return null;
    }

    // FOR: { for: "item", in: expr, do: [...] }
    if ('for' in stmt) {
      const s = stmt as ForStmt;
      const iterable = this.evalExpr(s.in, scope, context);
      if (!iterable || typeof (iterable as Iterable<unknown>)[Symbol.iterator] !== 'function') {
        throw new Error('for requires an iterable');
      }

      for (const item of iterable as Iterable<unknown>) {
        scope.set(s.for, item);
        const result = this.executeBlock(s.do || [], scope, context);
        if (result && result.__return__) {
          return result;
        }
      }
      return null;
    }

    // WHILE: { while: expr, do: [...] }
    if ('while' in stmt) {
      const s = stmt as WhileStmt;

      while (this.evalExpr(s.while, scope, context)) {
        const result = this.executeBlock(s.do || [], scope, context);
        if (result && result.__return__) {
          return result;
        }
      }
      return null;
    }

    // RETURN: { return: expr }
    if ('return' in stmt) {
      const s = stmt as ReturnStmt;
      return {
        __return__: true,
        value: this.evalExpr(s.return, scope, context),
      };
    }

    throw new Error(`Unknown statement: ${JSON.stringify(stmt)}`);
  }

  private evalExpr(expr: Expression, scope: Scope, context?: ExecutionContext): unknown {
    if (expr === null || expr === undefined) {
      return null;
    }

    // Shorthand: string → ref, number/boolean → literal
    if (typeof expr === 'string') {
      // Строка — это ссылка на переменную
      if (scope.has(expr)) {
        return scope.get(expr);
      }
      if (context?.builtins && expr in context.builtins) {
        return context.builtins[expr];
      }
      if (expr in this.builtins) {
        return this.builtins[expr];
      }
      throw new Error(`Undefined variable: "${expr}"`);
    }

    if (typeof expr === 'number' || typeof expr === 'boolean') {
      return expr;
    }

    // LITERAL: { literal: value }
    if ('literal' in expr) {
      return (expr as LiteralExpr).literal;
    }

    // REF: { ref: "name" }
    if ('ref' in expr) {
      const e = expr as RefExpr;
      if (scope.has(e.ref)) {
        return scope.get(e.ref);
      }
      if (context?.builtins && e.ref in context.builtins) {
        return context.builtins[e.ref];
      }
      if (e.ref in this.builtins) {
        return this.builtins[e.ref];
      }
      throw new Error(`Undefined variable: "${e.ref}"`);
    }

    // BINARY: { operator: "+", left: expr, right: expr }
    if ('operator' in expr && 'left' in expr && 'right' in expr) {
      const e = expr as BinaryExpr;
      const left = this.evalExpr(e.left, scope, context);
      const right = this.evalExpr(e.right, scope, context);
      return this.evalBinaryOp(e.operator, left, right);
    }

    // UNARY: { operator: "!", argument: expr }
    if ('operator' in expr && 'argument' in expr) {
      const e = expr as UnaryExpr;
      const arg = this.evalExpr(e.argument, scope, context);
      return this.evalUnaryOp(e.operator, arg);
    }

    // MEMBER: { object: expr, property: "name" }
    if ('object' in expr && 'property' in expr) {
      const e = expr as MemberExpr;
      const obj = this.evalExpr(e.object, scope, context) as Record<string, unknown> | null;
      if (obj === null || obj === undefined) {
        return undefined;
      }
      return obj[e.property];
    }

    // INDEX: { object: expr, index: expr }
    if ('object' in expr && 'index' in expr) {
      const e = expr as IndexExpr;
      const obj = this.evalExpr(e.object, scope, context) as unknown[] | string | null;
      const idx = this.evalExpr(e.index, scope, context) as number;
      if (obj === null || obj === undefined) {
        return undefined;
      }
      return obj[idx];
    }

    // CALL: { call: "fnName", arguments: [...] }
    if ('call' in expr) {
      const e = expr as CallExpr;
      const args = (e.arguments || []).map((a) => this.evalExpr(a, scope, context));
      const fnName = e.call;

      if (context?.builtins && fnName in context.builtins) {
        return context.builtins[fnName](...args);
      }
      if (fnName in this.builtins) {
        return this.builtins[fnName](...args);
      }
      if (context?.functions && fnName in context.functions) {
        return context.functions[fnName](...args);
      }
      const compiledFn = this.compiledFunctions.get(fnName);
      if (compiledFn) {
        return compiledFn(...args);
      }
      if (this.functionDefs.has(fnName)) {
        const fn = this.compile(fnName, context);
        return fn(...args);
      }
      throw new Error(`Unknown function: "${fnName}"`);
    }

    // METHOD: { method: "name", object: expr, arguments: [...] }
    if ('method' in expr) {
      const e = expr as MethodExpr;
      const obj = this.evalExpr(e.object, scope, context);
      const methodName = e.method;

      if (!this.allowedMethods.has(methodName)) {
        throw new Error(`Method "${methodName}" is not allowed`);
      }
      if (obj === null || obj === undefined) {
        throw new Error(`Cannot call method "${methodName}" on null/undefined`);
      }

      const method = (obj as Record<string, unknown>)[methodName];
      if (typeof method !== 'function') {
        return method;
      }

      const args = (e.arguments || []).map((a) => this.evalExpr(a, scope, context));
      return (method as Function).apply(obj, args);
    }

    // TERNARY: { condition: expr, then: expr, else: expr }
    if ('condition' in expr && 'then' in expr && 'else' in expr) {
      const e = expr as TernaryExpr;
      const cond = this.evalExpr(e.condition, scope, context);
      return cond
        ? this.evalExpr(e.then, scope, context)
        : this.evalExpr(e.else, scope, context);
    }

    // OBJECT: { properties: { key: expr, ... } }
    if ('properties' in expr) {
      const e = expr as ObjectExpr;
      const result: Record<string, unknown> = {};
      for (const [key, valExpr] of Object.entries(e.properties)) {
        result[key] = this.evalExpr(valExpr as Expression, scope, context);
      }
      return result;
    }

    // ARRAY: { elements: [...] }
    if ('elements' in expr) {
      const e = expr as ArrayExpr;
      return e.elements.map((el) => this.evalExpr(el, scope, context));
    }

    throw new Error(`Unknown expression: ${JSON.stringify(expr)}`);
  }

  private evalBinaryOp(op: BinaryOperator, l: unknown, r: unknown): unknown {
    switch (op) {
      case '+': return (l as number) + (r as number);
      case '-': return (l as number) - (r as number);
      case '*': return (l as number) * (r as number);
      case '/': return (r as number) !== 0 ? (l as number) / (r as number) : 0;
      case '%': return (l as number) % (r as number);
      case '==': return l == r;
      case '===': return l === r;
      case '!=': return l != r;
      case '!==': return l !== r;
      case '<': return (l as number) < (r as number);
      case '<=': return (l as number) <= (r as number);
      case '>': return (l as number) > (r as number);
      case '>=': return (l as number) >= (r as number);
      case '&&': return l && r;
      case '||': return l || r;
      case '&': return (l as number) & (r as number);
      case '|': return (l as number) | (r as number);
      case '^': return (l as number) ^ (r as number);
      default:
        throw new Error(`Unknown operator: "${op}"`);
    }
  }

  private evalUnaryOp(op: UnaryOperator, arg: unknown): unknown {
    switch (op) {
      case '!': return !arg;
      case '-': return -(arg as number);
      case '+': return +(arg as number);
      case '~': return ~(arg as number);
      default:
        throw new Error(`Unknown unary operator: "${op}"`);
    }
  }
}
